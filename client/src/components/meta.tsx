import { useEffect } from "react";

export interface MetaProps {
  title?: string;
  description?: string;
  schema?: Record<string, any> | string;
}

export default function Meta({ title, description, schema }: MetaProps) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    if (description) {
      let tag = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]'
      );
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', description);
    }

    let script: HTMLScriptElement | null = null;
    if (schema) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = typeof schema === 'string' ? schema : JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [title, description, schema]);

  return null;
}