import { useLanguage } from "@/context/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();
  
  return (
    <footer className="px-6 py-6 border-t border-zinc-800/50 mt-auto">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-zinc-600">
        <span>{t('copyright')}</span>
        <span className="font-mono text-xs">{t('poweredBy')}</span>
      </div>
    </footer>
  );
};

export default Footer;
