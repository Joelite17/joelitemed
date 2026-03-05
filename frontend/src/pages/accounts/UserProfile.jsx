import { useState, useEffect, useContext } from "react";
import FeedItem from "../../components/FeedItem";
import ProfileInfo from "../../components/ProfileInfo";
import FilterTabs from "../../components/FilterTabs";
import { AccountsContext } from "../../context/AccountsContext";
import { MCQAPI } from "../../apis/mcqs";

export default function UserProfilePage() {
  const [activeTab, setActiveTab] = useState("all");
  const [mcqPosts, setMcqPosts] = useState([]);
  const { user } = useContext(AccountsContext);

  // Construct the dynamic user object
  const userData = {
    name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username,
    username: `@${user.username}`,
    avatar: "https://i.pravatar.cc/100?img=3"
  };

  // Fetch MCQ sets from the backend
  useEffect(() => {
    const fetchMCQs = async () => {
      try {
        const data = await MCQAPI.fetchMCQSets();
        const mcqItems = data.map((item) => ({
          id: item.id,
          type: "MCQ",
          title: item.title
        }));
        setMcqPosts(mcqItems);
      } catch (err) {
        console.error("Failed to load MCQ data:", err);
      }
    };
    fetchMCQs();
  }, []);

  // Combine posts
  const posts = [
    {
      id: 1,
      type: "Note",
      title: "Understanding PEM pathophysiology",
    },
    ...mcqPosts,
    {
      id: 3,
      type: "Flashcard",
      title: "Key signs of protein-energy malnutrition",
    },
  ];

  const filteredPosts =
    activeTab === "all"
      ? posts
      : posts.filter((p) => p.type.toLowerCase() === activeTab);

  return (
    <div className="flex justify-center w-full min-h-screen text-gray-900 dark:text-gray-100">
      <div className="w-full lg:w-4/6 space-y-4 py-8 px-4">
        {/* Profile Header */}
        <ProfileInfo user={userData} />

        {/* Filter Tabs */}
        <FilterTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* User’s Posts */}
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => <FeedItem key={post.id} post={post} />)
        ) : (
          <p className="text-center text-gray-600 dark:text-gray-400 mt-8">
            No public posts available yet.
          </p>
        )}
      </div>
    </div>
  );
}
