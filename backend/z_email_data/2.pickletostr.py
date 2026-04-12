import base64

with open("token.pickle", "rb") as f:
    encoded = base64.b64encode(f.read()).decode()

print(encoded)