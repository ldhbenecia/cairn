'use client';

import { ArrowLeft, Ghost, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Ghost className="h-16 w-16 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="bg-gradient-to-r from-accent via-accent-hover to-[#a5b4fc] bg-clip-text text-5xl font-bold text-transparent">
            404
          </EmptyTitle>
          <EmptyDescription className="text-lg">
            This page doesn’t exist. It may have been moved or deleted.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={() => (window.location.href = '/')} className="group">
              <Home className="mr-1 h-4 w-4 transition-transform group-hover:scale-110" />
              Go home
            </Button>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="group"
            >
              <ArrowLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Go back
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
