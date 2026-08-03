import { GlossarySection } from "@/components/about/GlossarySection";

export default function Glossary() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
          Badminton Glossary
        </h1>
        <p className="text-muted-foreground mt-2">
          Learn the terminology used in badminton and around our club.
        </p>
      </div>
      <GlossarySection />
    </div>
  );
}
