import React, { useState, useRef, useEffect } from "react";
import mermaid from "mermaid";

const getCode = (arr = []) => {
  if (!Array.isArray(arr)) {
    arr = [arr];
  }
  return arr.map((dt) => {
    if (typeof dt === "string") {
      return dt;
    }
    if (dt.props && dt.props.children) {
      return getCode(dt.props.children);
    }
    return false;
  }).filter(Boolean).join("");
};

const CodeRenderer = ({ inline, children = [], className, ...props }) => {
  const demoid = useRef(`mermaid-${String(Math.random()).replace(/\./g, "")}`);
  const [container, setContainer] = useState(null);
  
  // Verify if it's a mermaid block
  const isMermaid = className && /^language-mermaid/.test(className.toLocaleLowerCase());
  const code = children ? getCode(children) : children;

  useEffect(() => {
    if (container && isMermaid && code) {
      let cleanCode = code;
      if (typeof cleanCode === 'string') {
        cleanCode = cleanCode
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/\u00A0/g, ' '); // Non-breaking spaces to regular spaces

        // Fix subgraph "Title with spaces" -> subgraph sg_X ["Title with spaces"]
        let sgCount = 0;
        cleanCode = cleanCode.replace(/subgraph\s+"([^"]+)"/g, (m, title) => {
          sgCount++;
          return `subgraph sg_${sgCount} ["${title}"]`;
        });
      }

      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose'
        });
        
        mermaid.render(demoid.current, cleanCode).then(({ svg, bindFunctions }) => {
          container.innerHTML = svg;
          if (bindFunctions) bindFunctions(container);
        }).catch(e => {
          container.innerHTML = `<pre style="color:red">Erro no diagrama Mermaid: ${e.message}</pre>`;
        });
      } catch (error) {
        console.error("Mermaid falhou:", error);
      }
    }
  }, [container, isMermaid, code, demoid]);

  if (isMermaid) {
    return (
      <div 
        ref={setContainer} 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          margin: '20px 0',
          background: '#fff',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid #ddd'
        }} 
      />
    );
  }
  
  return <code className={className} {...props}>{children}</code>;
};

export default CodeRenderer;
