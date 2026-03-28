'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, FolderGit2, Network, Activity, Settings, LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOut } from '@/lib/auth/helpers';

const navItems = [
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { label: 'Knowledge Graph', href: '/knowledge-graph', icon: Network },
  { label: 'Indexing Status', href: '/indexing', icon: Activity },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <span className="text-lg font-bold">RepoMind</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href}
                render={<Link href={item.href} />}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="flex flex-row items-center gap-2 p-4">
        <ThemeToggle />
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
