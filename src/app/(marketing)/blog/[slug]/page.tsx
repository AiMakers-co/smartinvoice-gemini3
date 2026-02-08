"use client";

import { useBrand } from "@/hooks/use-brand";
import { getPostBySlug, getRelatedPosts } from "@/lib/blog-data";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  Tag,
  Share2,
  Twitter,
  Linkedin,
  Link2,
  ArrowRight,
  BookOpen
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, notFound } from "next/navigation";
import { useEffect, useState } from "react";

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const brand = useBrand();
  const [readingProgress, setReadingProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const post = getPostBySlug(slug);
  const relatedPosts = getRelatedPosts(slug, 3);

  // Reading progress indicator
  useEffect(() => {
    const handleScroll = () => {
      const article = document.getElementById('article-content');
      if (!article) return;
      
      const totalHeight = article.offsetHeight;
      const windowHeight = window.innerHeight;
      const scrolled = window.scrollY - article.offsetTop + windowHeight;
      const progress = Math.min(Math.max((scrolled / totalHeight) * 100, 0), 100);
      setReadingProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!post) {
    notFound();
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse markdown-like content to HTML
  const renderContent = (content: string) => {
    return content
      .split('\n\n')
      .map((block, index) => {
        // Headers
        if (block.startsWith('## ')) {
          return (
            <h2 key={index} className="text-2xl font-bold text-slate-900 mt-10 mb-4">
              {block.replace('## ', '')}
            </h2>
          );
        }
        if (block.startsWith('### ')) {
          return (
            <h3 key={index} className="text-xl font-semibold text-slate-900 mt-8 mb-3">
              {block.replace('### ', '')}
            </h3>
          );
        }
        
        // Code blocks
        if (block.startsWith('```')) {
          const lines = block.split('\n');
          const language = lines[0].replace('```', '');
          const code = lines.slice(1, -1).join('\n');
          return (
            <pre key={index} className="bg-slate-900 text-slate-100 p-4 rounded-lg my-4 overflow-x-auto text-sm">
              <code>{code}</code>
            </pre>
          );
        }
        
        // Tables
        if (block.includes('|') && block.includes('---')) {
          const rows = block.split('\n').filter(row => row.trim() && !row.includes('---'));
          const headers = rows[0]?.split('|').filter(cell => cell.trim());
          const data = rows.slice(1).map(row => row.split('|').filter(cell => cell.trim()));
          
          return (
            <div key={index} className="my-6 overflow-x-auto">
              <table className="min-w-full border border-slate-200 rounded-lg">
                <thead className="bg-slate-50">
                  <tr>
                    {headers?.map((header, i) => (
                      <th key={i} className="px-4 py-2 text-left text-sm font-semibold text-slate-900 border-b">
                        {header.trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b last:border-0">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 text-sm text-slate-600">
                          {cell.trim()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        
        // Lists
        if (block.startsWith('- ') || block.startsWith('* ') || /^\d+\./.test(block)) {
          const items = block.split('\n').filter(line => line.trim());
          const isOrdered = /^\d+\./.test(items[0]);
          const ListTag = isOrdered ? 'ol' : 'ul';
          
          return (
            <ListTag key={index} className={`my-4 space-y-2 ${isOrdered ? 'list-decimal' : 'list-disc'} list-inside text-slate-600`}>
              {items.map((item, i) => {
                const text = item.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
                // Handle bold text
                const formattedText = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-slate-900">$1</strong>');
                return (
                  <li key={i} dangerouslySetInnerHTML={{ __html: formattedText }} />
                );
              })}
            </ListTag>
          );
        }
        
        // Checkboxes
        if (block.includes('✅')) {
          const items = block.split('\n').filter(line => line.trim());
          return (
            <div key={index} className="my-4 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-600">
                  <span className="text-green-500 mt-0.5">✅</span>
                  <span>{item.replace('✅', '').trim()}</span>
                </div>
              ))}
            </div>
          );
        }
        
        // Blockquotes
        if (block.startsWith('>')) {
          return (
            <blockquote 
              key={index} 
              className="border-l-4 pl-4 py-2 my-4 text-slate-600 italic bg-slate-50 rounded-r-lg"
              style={{ borderColor: brand.colors.primary }}
            >
              {block.replace(/^>\s*/gm, '')}
            </blockquote>
          );
        }
        
        // Regular paragraphs
        if (block.trim()) {
          // Handle inline formatting
          let formattedBlock = block
            .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-slate-900">$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-800">$1</code>');
          
          return (
            <p 
              key={index} 
              className="text-slate-600 leading-relaxed my-4"
              dangerouslySetInnerHTML={{ __html: formattedBlock }}
            />
          );
        }
        
        return null;
      });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Reading Progress Bar */}
      <div 
        className="fixed top-0 left-0 h-1 z-50 transition-all duration-150"
        style={{ 
          width: `${readingProgress}%`,
          backgroundColor: brand.colors.primary 
        }}
      />

      {/* Hero Section with Header Image */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(${brand.colors.primary} 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Back button */}
          <Link 
            href="/blog"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to Blog
          </Link>
          
          {/* Category & Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span 
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${brand.colors.primary}30`, color: brand.colors.primary }}
            >
              {post.category}
            </span>
            {post.featured && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                Featured
              </span>
            )}
          </div>
          
          {/* Title */}
          <h1 className="text-3xl lg:text-5xl font-bold mb-6 leading-tight">
            {post.title}
          </h1>
          
          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {post.date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </span>
          </div>
        </div>
      </section>

      {/* Header Image */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div 
          className="relative h-64 md:h-96 rounded-2xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: `${brand.colors.primary}15` }}
        >
          {post.image && post.image !== '/blog/placeholder.png' ? (
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover"
              priority
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
      </div>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-8">
          {/* Share Sidebar (Desktop) */}
          <aside className="hidden lg:block w-16 shrink-0">
            <div className="sticky top-24 space-y-3">
              <p className="text-xs text-slate-400 font-medium mb-2">Share</p>
              <button 
                onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`, '_blank')}
                className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </button>
              <button 
                onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank')}
                className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </button>
              <button 
                onClick={handleCopyLink}
                className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors relative"
              >
                <Link2 className="h-4 w-4" />
                {copied && (
                  <span className="absolute -right-16 text-xs text-green-600 font-medium whitespace-nowrap">
                    Copied!
                  </span>
                )}
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <div id="article-content" className="flex-1 min-w-0">
            <div className="prose prose-slate max-w-none">
              {renderContent(post.content)}
            </div>

            {/* Tags */}
            <div className="mt-12 pt-8 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400" />
                {post.tags.map((tag) => (
                  <span 
                    key={tag}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Mobile Share */}
            <div className="mt-8 lg:hidden">
              <p className="text-sm text-slate-500 mb-3">Share this article</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`, '_blank')}
                  className="flex-1 py-2 rounded-lg bg-slate-100 flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-200 transition-colors text-sm"
                >
                  <Twitter className="h-4 w-4" />
                  Twitter
                </button>
                <button 
                  onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank')}
                  className="flex-1 py-2 rounded-lg bg-slate-100 flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-200 transition-colors text-sm"
                >
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </button>
                <button 
                  onClick={handleCopyLink}
                  className="flex-1 py-2 rounded-lg bg-slate-100 flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-200 transition-colors text-sm"
                >
                  <Link2 className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="bg-white border-t border-slate-200 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Related Articles</h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Link 
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="group bg-slate-50 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  <div 
                    className="h-40 relative"
                    style={{ backgroundColor: `${brand.colors.primary}10` }}
                  >
                    {relatedPost.image && relatedPost.image !== '/blog/placeholder.png' ? (
                      <Image
                        src={relatedPost.image}
                        alt={relatedPost.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="h-8 w-8" style={{ color: brand.colors.primary }} />
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-5">
                    <span 
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-2"
                      style={{ backgroundColor: `${brand.colors.primary}10`, color: brand.colors.primary }}
                    >
                      {relatedPost.category}
                    </span>
                    <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 group-hover:underline">
                      {relatedPost.title}
                    </h3>
                    <p className="text-sm text-slate-500">{relatedPost.readTime}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter CTA */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Enjoyed this article?
          </h2>
          <p className="text-slate-600 mb-6 max-w-xl mx-auto">
            Subscribe to our newsletter and never miss an update. Get the latest insights 
            delivered straight to your inbox.
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

      {/* Back to Blog */}
      <div className="py-8 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link 
            href="/blog"
            className="inline-flex items-center gap-2 font-medium transition-colors hover:opacity-80"
            style={{ color: brand.colors.primary }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all articles
          </Link>
        </div>
      </div>
    </div>
  );
}
