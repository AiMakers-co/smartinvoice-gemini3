"use client";

import { useBrand } from "@/hooks/use-brand";
import { getAllPosts, getFeaturedPost, getAllCategories, type BlogCategory, type BlogPost } from "@/lib/blog-data";
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  ArrowRight,
  Tag,
  User,
  Search,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useMemo } from "react";

export default function BlogPage() {
  const brand = useBrand();
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");

  const allPosts = getAllPosts();
  const featuredPost = getFeaturedPost();
  const categories = getAllCategories();

  // Filter posts based on category and search
  const filteredPosts = useMemo(() => {
    let posts = allPosts.filter(post => !post.featured); // Exclude featured from grid
    
    if (selectedCategory !== "All") {
      posts = posts.filter(post => post.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      posts = posts.filter(post => 
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return posts;
  }, [allPosts, selectedCategory, searchQuery]);

  // Category colors for visual distinction
  const getCategoryColor = (category: BlogCategory): string => {
    const colors: Record<BlogCategory, string> = {
      "Announcement": "#F59E0B",
      "Technology": "#3B82F6",
      "Security": "#10B981",
      "Tips & Tricks": "#8B5CF6",
      "Tutorials": "#EC4899",
      "Education": "#06B6D4",
    };
    return colors[category] || brand.colors.primary;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-20 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(${brand.colors.primary} 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Decorative gradient blobs */}
        <div 
          className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: `radial-gradient(circle, ${brand.colors.primary}, transparent)` }}
        />
        <div 
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: `radial-gradient(circle, #F59E0B, transparent)` }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${brand.colors.primary}20` }}
            >
              <BookOpen className="h-8 w-8" style={{ color: brand.colors.primary }} />
            </div>
            <span className="text-slate-400 text-sm font-medium">Resources</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-slate-300 max-w-2xl">
            Insights, tutorials, and updates from the {brand.content.name} team. Learn how to make the most 
            of AI-powered financial document processing.
          </p>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="py-6 bg-white border-b border-slate-200 sticky top-16 lg:top-20 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto scrollbar-hide">
              <button
                onClick={() => setSelectedCategory("All")}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === "All" 
                    ? "text-white shadow-md" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                style={selectedCategory === "All" ? { backgroundColor: brand.colors.primary } : {}}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat 
                      ? "text-white shadow-md" 
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  style={selectedCategory === cat ? { backgroundColor: getCategoryColor(cat) } : {}}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="search"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ "--tw-ring-color": brand.colors.primary } as React.CSSProperties}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      {featuredPost && selectedCategory === "All" && !searchQuery && (
        <section className="py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link 
              href={`/blog/${featuredPost.slug}`}
              className="block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all group"
            >
              <div className="grid md:grid-cols-2">
                {/* Image */}
                <div 
                  className="h-64 md:h-auto relative overflow-hidden"
                  style={{ backgroundColor: `${brand.colors.primary}15` }}
                >
                  {featuredPost.image ? (
                    <Image
                      src={featuredPost.image}
                      alt={featuredPost.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div 
                        className="w-24 h-24 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: `${brand.colors.primary}20` }}
                      >
                        <BookOpen className="h-12 w-12" style={{ color: brand.colors.primary }} />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${getCategoryColor(featuredPost.category)}15`, color: getCategoryColor(featuredPost.category) }}
                    >
                      {featuredPost.category}
                    </span>
                    <span className="flex items-center gap-1 text-amber-500 text-sm font-medium">
                      <Sparkles className="h-3.5 w-3.5" />
                      Featured
                    </span>
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-3 group-hover:underline decoration-2 underline-offset-4">
                    {featuredPost.title}
                  </h2>
                  <p className="text-slate-600 mb-6">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {featuredPost.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {featuredPost.readTime}
                    </span>
                  </div>
                  <div>
                    <span 
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white group-hover:gap-3 transition-all"
                      style={{ backgroundColor: brand.colors.primary }}
                    >
                      Read Article
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Posts Grid */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              {selectedCategory === "All" && !searchQuery ? "Latest Articles" : 
               searchQuery ? `Search Results (${filteredPosts.length})` :
               `${selectedCategory} (${filteredPosts.length})`}
            </h2>
          </div>
          
          {filteredPosts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => (
                <BlogCard key={post.slug} post={post} brandColors={brand.colors} getCategoryColor={getCategoryColor} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div 
                className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${brand.colors.primary}10` }}
              >
                <Search className="h-8 w-8" style={{ color: brand.colors.primary }} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No articles found</h3>
              <p className="text-slate-600 mb-6">
                Try adjusting your search or filter to find what you're looking for.
              </p>
              <button
                onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}
                className="px-4 py-2 rounded-lg font-medium text-white"
                style={{ backgroundColor: brand.colors.primary }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div 
            className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-6"
            style={{ backgroundColor: `${brand.colors.primary}10` }}
          >
            <BookOpen className="h-7 w-7" style={{ color: brand.colors.primary }} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Subscribe to our newsletter
          </h2>
          <p className="text-slate-600 mb-6 max-w-xl mx-auto">
            Get the latest articles, product updates, and tips delivered to your inbox. 
            No spam, unsubscribe anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input 
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ "--tw-ring-color": brand.colors.primary } as React.CSSProperties}
            />
            <button 
              className="px-6 py-3 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: brand.colors.primary }}
            >
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================
// BLOG CARD COMPONENT
// ============================================

interface BlogCardProps {
  post: BlogPost;
  brandColors: { primary: string };
  getCategoryColor: (category: BlogCategory) => string;
}

function BlogCard({ post, brandColors, getCategoryColor }: BlogCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all"
    >
      {/* Image */}
      <div 
        className="h-44 relative overflow-hidden"
        style={{ backgroundColor: `${brandColors.primary}10` }}
      >
        {post.image ? (
          <Image
            src={post.image}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="h-8 w-8" style={{ color: brandColors.primary }} />
          </div>
        )}
        
        {/* Category overlay */}
        <div className="absolute top-3 left-3">
          <span 
            className="px-2.5 py-1 rounded-md text-xs font-medium text-white shadow-sm"
            style={{ backgroundColor: getCategoryColor(post.category) }}
          >
            {post.category}
          </span>
        </div>
      </div>
      
      <div className="p-5">
        <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 group-hover:underline decoration-1 underline-offset-2">
          {post.title}
        </h3>
        <p className="text-sm text-slate-600 mb-4 line-clamp-2">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {post.author}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {post.readTime}
          </span>
        </div>
      </div>
    </Link>
  );
}