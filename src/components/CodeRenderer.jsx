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
      // Basic sanitization to fix AI-generated unquoted labels that contain special characters
      let sanitizedCode = code;
      try {
        sanitizedCode = sanitizedCode.replace(/\[([^"\]]+)\]/g, '["$1"]');
        sanitizedCode = sanitizedCode.replace(/\{([^"\}]+)\}/g, '{"$1"}');
        sanitizedCode = sanitizedCode.replace(/(?<!\()\(([^"\)]+)\)(?!\))/g, '("$1")');
        sanitizedCode = sanitizedCode.replace(/\(\(([^"\)]+)\)\)/g, '(("$1"))');
      } catch (e) {
        console.warn("Mermaid sanitization regex failed", e);
      }

      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose'
        });
        
        mermaid.render(demoid.current, sanitizedCode).then(({ svg, bindFunctions }) => {
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
