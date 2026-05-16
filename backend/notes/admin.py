import os
import json
import re
from django.contrib import admin
from django import forms
from django.shortcuts import render
from django.urls import path, reverse
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.db import transaction
from docx import Document
from .models import Note

# ----------------------------------------------------------------------
# Custom multiple file field and widget (Django 3.2+)
# ----------------------------------------------------------------------
class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True

class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        single_file_clean = super().clean
        if isinstance(data, (list, tuple)):
            result = [single_file_clean(d, initial) for d in data]
        else:
            result = [single_file_clean(data, initial)]
        return result

# ----------------------------------------------------------------------
# Helper: Convert a docx paragraph to HTML with formatting
# ----------------------------------------------------------------------
def paragraph_to_html(paragraph):
    html_parts = []
    for run in paragraph.runs:
        text = run.text
        if not text:
            continue
        text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        if run.bold:
            text = f"<strong>{text}</strong>"
        if run.underline:
            text = f"<u>{text}</u>"
        if run.italic:
            text = f"<em>{text}</em>"
        html_parts.append(text)
    return ''.join(html_parts)

def docx_to_html(docx_file):
    doc = Document(docx_file)
    html_lines = []
    for para in doc.paragraphs:
        if not para.text.strip():
            html_lines.append("<br>")
            continue
        if para.style.name.startswith('Heading'):
            level = para.style.name.replace('Heading', '').strip()
            tag = f"h{level}" if level.isdigit() else "h3"
            html_lines.append(f"<{tag}>{paragraph_to_html(para)}</{tag}>")
        else:
            text = para.text.strip()
            if re.match(r'^(\d+\.|-|\*)\s', text):
                html_lines.append(f"<p class='list-item'>{paragraph_to_html(para)}</p>")
            else:
                html_lines.append(f"<p>{paragraph_to_html(para)}</p>")
    return '\n'.join(html_lines)

def text_to_note_html(text):
    if not text:
        return ""
    lines = text.split('\n')
    html_parts = []
    in_ol = False
    in_ul = False
    list_items = []
    ol_pattern = re.compile(r'^(\d+)[\.\)]\s+(.*)$')
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_ol:
                html_parts.append('<ol>')
                html_parts.extend(f'<li>{item}</li>' for item in list_items)
                html_parts.append('</ol>')
                in_ol = False
                list_items = []
            if in_ul:
                html_parts.append('<ul>')
                html_parts.extend(f'<li>{item}</li>' for item in list_items)
                html_parts.append('</ul>')
                in_ul = False
                list_items = []
            html_parts.append('<br>')
            continue
        if stripped.isupper() and len(stripped) > 2:
            if in_ol:
                html_parts.append('<ol>')
                html_parts.extend(f'<li>{item}</li>' for item in list_items)
                html_parts.append('</ol>')
                in_ol = False
                list_items = []
            if in_ul:
                html_parts.append('<ul>')
                html_parts.extend(f'<li>{item}</li>' for item in list_items)
                html_parts.append('</ul>')
                in_ul = False
                list_items = []
            html_parts.append(f'<h3>{stripped}</h3>')
            continue
        numbered_match = ol_pattern.match(stripped)
        if numbered_match:
            if in_ul:
                html_parts.append('<ul>')
                html_parts.extend(f'<li>{item}</li>' for item in list_items)
                html_parts.append('</ul>')
                in_ul = False
                list_items = []
            if not in_ol:
                if list_items:
                    html_parts.append('<ol>')
                    html_parts.extend(f'<li>{item}</li>' for item in list_items)
                    html_parts.append('</ol>')
                    list_items = []
                in_ol = True
            item_text = numbered_match.group(2).strip()
            list_items.append(item_text)
            continue
        if stripped.startswith('- ') or stripped.startswith('* '):
            if in_ol:
                html_parts.append('<ol>')
                html_parts.extend(f'<li>{item}</li>' for item in list_items)
                html_parts.append('</ol>')
                in_ol = False
                list_items = []
            if not in_ul:
                if list_items:
                    html_parts.append('<ul>')
                    html_parts.extend(f'<li>{item}</li>' for item in list_items)
                    html_parts.append('</ul>')
                    list_items = []
                in_ul = True
            item_text = stripped[2:].strip()
            list_items.append(item_text)
            continue
        if in_ol:
            html_parts.append('<ol>')
            html_parts.extend(f'<li>{item}</li>' for item in list_items)
            html_parts.append('</ol>')
            in_ol = False
            list_items = []
        if in_ul:
            html_parts.append('<ul>')
            html_parts.extend(f'<li>{item}</li>' for item in list_items)
            html_parts.append('</ul>')
            in_ul = False
            list_items = []
        html_parts.append(f'<p>{stripped}</p>')
    if in_ol:
        html_parts.append('<ol>')
        html_parts.extend(f'<li>{item}</li>' for item in list_items)
        html_parts.append('</ol>')
    if in_ul:
        html_parts.append('<ul>')
        html_parts.extend(f'<li>{item}</li>' for item in list_items)
        html_parts.append('</ul>')
    return '\n'.join(html_parts)

def extract_title_from_text(text, default="Untitled Note"):
    lines = text.strip().split('\n')
    for line in lines:
        stripped = line.strip()
        if stripped:
            if stripped.isupper() or stripped.endswith(':'):
                return stripped.rstrip(':')
            return stripped[:255]
    return default

def json_to_note_html(json_data):
    """Convert JSON array to HTML."""
    meta = json_data[0]['META_DATA']
    heading_styles = meta.get('HEADING_STYLING', [])
    style_parts = []
    if 'BOLD' in heading_styles:
        style_parts.append('font-weight: bold')
    if 'UNDERLINE' in heading_styles:
        style_parts.append('text-decoration: underline')
    heading_style = f' style="{"; ".join(style_parts)};"' if style_parts else ''

    html_parts = []
    for section in json_data[1:]:
        for key, content in section.items():
            if not key.isdigit():
                continue
            heading = content.get('HEADING', '')
            listing = content.get('LISTING', [])
            if heading:
                heading_escaped = heading.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                html_parts.append(f'<h3{heading_style}>{heading_escaped}</h3>')
            if listing:
                html_parts.append('<ul>')
                for item in listing:
                    item_escaped = item.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    html_parts.append(f'<li>{item_escaped}</li>')
                html_parts.append('</ul>')
    return '\n'.join(html_parts)

# ----------------------------------------------------------------------
# Upload Form – uses custom MultipleFileField
# ----------------------------------------------------------------------
class NoteDocumentUploadForm(forms.Form):
    files = MultipleFileField(
        label='Document Files',
        help_text='Upload one or more files (.json, .txt, .docx)'
    )
    title = forms.CharField(
        required=False,
        label='Default Title',
        help_text='Used only for .txt/.docx files (ignored for JSON)'
    )
    visibility = forms.ChoiceField(
        choices=[('public', 'Public'), ('private', 'Private'), ('subscriber', 'Subscriber')],
        required=False,
        initial='private',
        label='Default Visibility',
        help_text='Used only for .txt/.docx files (ignored for JSON)'
    )
    overwrite = forms.BooleanField(
        required=False,
        initial=False,
        label='Overwrite existing notes with same title',
        help_text='If checked, any existing note with the same title will have its content replaced.'
    )

# ----------------------------------------------------------------------
# Note Admin
# ----------------------------------------------------------------------
class NoteAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'visibility', 'created_at', 'likes_count')
    list_filter = ('visibility', 'created_at')
    search_fields = ('title', 'content', 'user__username')
    change_list_template = "admin/notes/note/change_list.html"

    def likes_count(self, obj):
        return obj.likes.count()
    likes_count.short_description = "Likes"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'upload-document/',
                self.admin_site.admin_view(self.upload_document),
                name='notes_note_upload_document',
            ),
        ]
        return custom_urls + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['upload_document_url'] = reverse('admin:notes_note_upload_document')
        return super().changelist_view(request, extra_context=extra_context)

    def upload_document(self, request):
        if request.method == 'POST':
            form = NoteDocumentUploadForm(request.POST, request.FILES)
            if form.is_valid():
                files = request.FILES.getlist('files')
                if not files:
                    messages.error(request, "No files selected.")
                else:
                    overwrite = form.cleaned_data['overwrite']
                    default_title = form.cleaned_data['title']
                    default_visibility = form.cleaned_data['visibility']
                    results = []

                    for f in files:
                        file_extension = os.path.splitext(f.name)[1].lower()
                        try:
                            # ----- JSON file -----
                            if file_extension == '.json':
                                json_data = json.load(f)
                                if not isinstance(json_data, list) or len(json_data) == 0:
                                    raise ValueError("JSON must be a non‑empty array.")
                                meta = json_data[0].get('META_DATA', {})
                                title = meta.get('TOPIC', 'Untitled Note')
                                visibility = meta.get('VISIBILITY', 'private').lower()
                                html_content = json_to_note_html(json_data)
                                course_map = {
                                    'MEDICINE': 'medicine',
                                    'SURGERY': 'surgery',
                                    'COMMED': 'commed',
                                }
                                course_mode = course_map.get(meta.get('COURSE', '').upper(), 'commed')

                                result = self.process_document_data(
                                    html_content, title, visibility,
                                    overwrite, request.user, course_mode
                                )

                            # ----- Plain text file -----
                            elif file_extension == '.txt':
                                content_text = f.read().decode('utf-8')
                                title = default_title if default_title else extract_title_from_text(content_text)
                                visibility = default_visibility
                                html_content = text_to_note_html(content_text)
                                result = self.process_document_data(
                                    html_content, title, visibility,
                                    overwrite, request.user, 'commed'
                                )

                            # ----- Word document -----
                            elif file_extension == '.docx':
                                html_content = docx_to_html(f)
                                title = default_title if default_title else extract_title_from_text(html_content)
                                visibility = default_visibility
                                result = self.process_document_data(
                                    html_content, title, visibility,
                                    overwrite, request.user, 'commed'
                                )
                            else:
                                result = {'success': False, 'message': f"Unsupported file type: {file_extension}"}

                            results.append({
                                'success': result['success'],
                                'filename': f.name,
                                'title': title if 'title' in locals() else '?',
                                'message': result.get('message', 'Success')
                            })

                        except Exception as e:
                            results.append({
                                'success': False,
                                'filename': f.name,
                                'title': '',
                                'message': str(e)
                            })

                    # Show aggregated messages
                    successes = [r for r in results if r['success']]
                    errors = [r for r in results if not r['success']]

                    if successes:
                        msg_lines = [f"✅ Successfully processed {len(successes)} file(s):"]
                        for s in successes:
                            msg_lines.append(f"  • {s['filename']} → '{s['title']}'")
                        messages.success(request, "\n".join(msg_lines))
                    if errors:
                        for err in errors:
                            messages.error(request, f"❌ {err['filename']}: {err['message']}")

                    return HttpResponseRedirect('..')
            else:
                messages.error(request, "Invalid form submission.")
        else:
            form = NoteDocumentUploadForm()

        context = {
            'form': form,
            'title': 'Upload Notes',
            'opts': self.model._meta,
            'media': self.media,
            'has_permission': True,
        }
        return render(request, 'admin/note_upload_json.html', context)

    def process_document_data(self, html_content, title, visibility, overwrite, user, course_mode='commed'):
        try:
            with transaction.atomic():
                if overwrite:
                    note, created = Note.objects.get_or_create(
                        title=title,
                        defaults={
                            'content': html_content,
                            'user': user,
                            'visibility': visibility,
                            'course_mode': course_mode
                        }
                    )
                    if not created:
                        note.content = html_content
                        note.user = user
                        note.visibility = visibility
                        note.course_mode = course_mode
                        note.save()
                else:
                    note = Note.objects.create(
                        title=title,
                        content=html_content,
                        user=user,
                        visibility=visibility,
                        course_mode=course_mode
                    )
                return {'success': True, 'note_id': note.id}
        except Exception as e:
            return {'success': False, 'message': f"Database error: {str(e)}"}

# Register the admin
try:
    admin.site.unregister(Note)
except admin.sites.NotRegistered:
    pass
admin.site.register(Note, NoteAdmin)