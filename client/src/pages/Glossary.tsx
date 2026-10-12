import { GlossarySection } from "@/components/about/GlossarySection";
import { PageHeader } from "@/components/ui/PageHeader";
import { BookOpen } from "lucide-react";

export default function Glossary() {
  return (
    <div className="min-h-screen pb-24 lg:pb-8">
      <PageHeader
        badge="Reference"
        badgeIcon={<BookOpen className="w-3.5 h-3.5" />}
        title="Badminton Glossary"
        subtitle="Learn the terminology used in badminton and around our club."
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <GlossarySection />
      </div>
    </div>
  );
}
