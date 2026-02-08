"use client";

import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { AIAssistantTrigger } from "@/components/ai-assistant";
import Link from "next/link";

interface HeaderProps {
  title?: string;
  showAIAssistant?: boolean;
}

export function Header({ title, showAIAssistant = true }: HeaderProps) {
  const { user, signOut } = useAuth();

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <header className="sticky top-0 z-40 flex h-11 items-center justify-between border-b bg-white px-4">
      <div className="flex items-center gap-3">
        {title && <h1 className="text-sm font-semibold text-slate-900">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search..."
            className="w-48 h-7 pl-8 text-xs"
          />
        </div>

        {/* AI Assistant */}
        {showAIAssistant && <AIAssistantTrigger variant="header" />}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-7 w-7">
          <Bell className="h-4 w-4 text-slate-500" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ormandy-red text-[9px] font-bold text-white">
            3
          </span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-7 w-7 rounded-full p-0">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-xs font-medium">{user?.name}</p>
                <p className="text-[10px] text-slate-500">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-xs">
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs">
              <Link href="/team">Team</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-xs text-red-600">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
