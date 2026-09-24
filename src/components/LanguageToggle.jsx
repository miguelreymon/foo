import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

export const LanguageToggle = ({ className = "" }) => {
  const { language, setLanguage } = useLanguage();
  
  return (
    <Button
      data-testid="language-toggle"
      variant="outline"
      size="sm"
      onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
      className={`flex items-center gap-2 bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-white ${className}`}
    >
      <Globe className="h-4 w-4" />
      <span className="font-medium">{language.toUpperCase()}</span>
    </Button>
  );
};

export default LanguageToggle;
