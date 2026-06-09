import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description?: string;
}

export function usePageMeta({ title, description }: PageMetaOptions) {
  useEffect(() => {
    const fullTitle = `${title} | IISc Badminton Club`;
    document.title = fullTitle;

    function setOrCreate(attrKey: string, attrVal: string, content: string) {
      let el = document.querySelector(`meta[${attrKey}="${attrVal}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrKey, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    }

    setOrCreate("property", "og:title", fullTitle);
    setOrCreate("name", "twitter:title", fullTitle);

    if (description) {
      setOrCreate("name", "description", description);
      setOrCreate("property", "og:description", description);
      setOrCreate("name", "twitter:description", description);
    }
  }, [title, description]);
}
