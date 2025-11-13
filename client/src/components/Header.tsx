import { Building2, FileDown, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

interface HeaderProps {
  onExportPDF?: () => void;
}

export default function Header({ onExportPDF }: HeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Phân Tích BĐS Việt Nam</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              AI-Powered Real Estate Analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="default"
            onClick={onExportPDF}
            className="hidden sm:flex"
            data-testid="button-export-pdf"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Xuất Báo Cáo
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={onExportPDF}
            className="sm:hidden"
            data-testid="button-export-pdf-mobile"
          >
            <FileDown className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
