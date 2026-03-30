'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, FolderGit2, Network, Settings, LogOut, Brain } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { signOut } from '@/lib/auth/helpers';

const navItems = [
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { label: 'Knowledge Graph', href: '/knowledge-graph', icon: Network },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/chat') {
    return pathname === '/chat' || pathname.startsWith('/chat/');
  }
  return pathname.startsWith(href);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <span className="text-base font-semibold">RepoMind</span>
            <p className="text-xs text-muted-foreground">Codebase AI</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="px-2 py-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={isActive(pathname, item.href)}
                render={<Link href={item.href} />}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-3">
        <button
          onClick={signOut}
          className="inline-flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
