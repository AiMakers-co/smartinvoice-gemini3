"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight,
  Mail,
  MessageSquare,
  Phone,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Loader2,
  Building2,
  Users,
  Sparkles,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================
// CONTACT PAGE
// ============================================

export default function ContactPage() {
  const brand = useBrand();
  const [formState, setFormState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
    type: "general",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("loading");
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setFormState("success");
  };

  const contactOptions = [
    {
      icon: Mail,
      title: "Email Us",
      description: "We'll respond within 24 hours",
      action: "mark@aimakers.co",
      href: "mailto:mark@aimakers.co",
    },
    {
      icon: MessageSquare,
      title: "WhatsApp",
      description: "Message us directly",
      action: "+599 9697 5324",
      href: "https://wa.me/59996975324",
    },
    {
      icon: Phone,
      title: "Call Us",
      description: "Available for consultations",
      action: "+599 9697 5324",
      href: "tel:+59996975324",
    },
  ];

  const offices = [
    {
      city: "Curaçao",
      address: "10-12 Snipweg",
      zip: "Willemstad, Curaçao",
    },
  ];

  return (
    <div className="bg-white">
      {/* Hero Section with Header Image */}
      <section className="relative pt-20 overflow-hidden">
        {/* Header Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/headers/contact-header.png"
            alt="Contact"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/60" />
        </div>
            
        <div className="relative z-10 py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p 
                className="text-sm font-semibold tracking-wide uppercase mb-4"
                style={{ color: brand.colors.primary }}
              >
                Contact Us
              </p>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Let's discuss your requirements
              </h1>
              
              <p className="mt-6 text-xl text-slate-300 leading-relaxed max-w-2xl">
                Get in touch with our team to learn how {brand.content.name} can streamline 
                your document processing workflows.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-all"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="mailto:mark@aimakers.co"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all backdrop-blur-sm"
                >
                  Email Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-16 bg-white -mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {contactOptions.map((option) => (
              <a
                key={option.title}
                href={option.href}
                className="p-6 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors group"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: `${brand.colors.primary}15` }}
                >
                  <option.icon className="w-6 h-6" style={{ color: brand.colors.primary }} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  {option.title}
                </h3>
                <p className="text-slate-500 text-sm mb-3">
                  {option.description}
                </p>
                <span className="font-medium" style={{ color: brand.colors.primary }}>
                  {option.action}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Form */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Send us a message
              </h2>

              {formState === "success" ? (
                <div className="p-8 bg-emerald-50 rounded-2xl text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-emerald-900 mb-2">
                    Message sent!
                  </h3>
                  <p className="text-emerald-700 mb-6">
                    Thanks for reaching out. We'll get back to you within 24 hours.
                  </p>
                  <Button
                    onClick={() => {
                      setFormState("idle");
                      setFormData({ name: "", email: "", company: "", message: "", type: "general" });
                    }}
                    variant="outline"
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Inquiry Type */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "general", label: "General Inquiry" },
                      { value: "sales", label: "Sales" },
                      { value: "support", label: "Support" },
                      { value: "partnership", label: "Partnership" },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.type === type.value
                            ? "text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                        style={formData.type === type.value ? { backgroundColor: brand.colors.primary } : undefined}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Smith"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company (optional)</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="Acme Inc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Tell us how we can help..."
                      rows={5}
                      required
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 outline-none transition-all resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={formState === "loading"}
                    className="w-full sm:w-auto px-8 py-3 text-white"
                    style={{ backgroundColor: brand.colors.primary }}
                  >
                    {formState === "loading" ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <Send className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Info */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Contact Information
              </h2>
              
              <p className="text-slate-600 mb-8">
                Fill out the form and our team will get back to you within 24 hours.
              </p>

              <div className="space-y-6 mb-12">
                <div className="p-6 bg-slate-50 rounded-xl">
                  <div className="flex items-start gap-3 mb-3">
                    <MessageSquare className="w-5 h-5 mt-1" style={{ color: brand.colors.primary }} />
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">WhatsApp</h3>
                      <a 
                        href="https://wa.me/59996975324" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:underline"
                      >
                        +599 9697 5324
                      </a>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-xl">
                  <div className="flex items-start gap-3 mb-3">
                    <Mail className="w-5 h-5 mt-1" style={{ color: brand.colors.primary }} />
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Email</h3>
                      <a 
                        href="mailto:mark@aimakers.co" 
                        className="text-slate-600 hover:underline"
                      >
                        mark@aimakers.co
                      </a>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 mt-1" style={{ color: brand.colors.primary }} />
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Location</h3>
                      <p className="text-slate-600 text-sm">
                        10-12 Snipweg
                        <br />
                        Willemstad, Curaçao
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ CTA */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Have more questions?
          </h2>
          <p className="text-slate-600 mb-8">
            Check out our frequently asked questions or browse our help center for instant answers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing#faq"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold rounded-xl bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 transition-all"
            >
              View FAQ
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold rounded-xl text-white transition-all"
              style={{ backgroundColor: brand.colors.primary }}
            >
              Help Center
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section 
        className="py-20"
        style={{ backgroundColor: brand.colors.sidebar }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Building2 className="w-12 h-12 text-white/40 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Built by AI Makers
          </h2>
          <p className="mt-4 text-lg text-white/70">
            This platform is developed by AI Makers, a custom AI development agency specializing in bespoke AI solutions, workflow automation, and corporate AI training.
          </p>
          <a
            href="https://www.aimakers.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 mt-8 text-base font-semibold rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-all"
          >
            Visit AI Makers
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>
    </div>
  );
}

