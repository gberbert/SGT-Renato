import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Flex, IconButton, Box } from '@radix-ui/themes';
import { Bold, Italic, Strikethrough, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Heading1, Heading2, Heading3, Code } from 'lucide-react';
import './RichTextEditor.css'; 

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const toggleLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('URL da imagem');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <Flex gap="1" p="2" style={{ borderBottom: '1px solid var(--gray-5)', background: 'var(--gray-3)', borderTopLeftRadius: 'var(--radius-3)', borderTopRightRadius: 'var(--radius-3)' }} wrap="wrap">
      <IconButton 
        size="1" 
        variant={editor.isActive('bold') ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
      >
        <Bold size={14} />
      </IconButton>
      <IconButton 
        size="1" 
        variant={editor.isActive('italic') ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
      >
        <Italic size={14} />
      </IconButton>
      <IconButton 
        size="1" 
        variant={editor.isActive('strike') ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}
      >
        <Strikethrough size={14} />
      </IconButton>
      <IconButton 
        size="1" 
        variant={editor.isActive('codeBlock') ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run() }}
      >
        <Code size={14} />
      </IconButton>
      <div style={{ width: '1px', background: 'var(--gray-5)', margin: '0 4px' }} />
      <IconButton 
        size="1" 
        variant={editor.isActive('heading', { level: 1 }) ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run() }}
      >
        <Heading1 size={14} />
      </IconButton>
      <IconButton 
        size="1" 
        variant={editor.isActive('heading', { level: 2 }) ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}
      >
        <Heading2 size={14} />
      </IconButton>
      <IconButton 
        size="1" 
        variant={editor.isActive('heading', { level: 3 }) ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }}
      >
        <Heading3 size={14} />
      </IconButton>
      <div style={{ width: '1px', background: 'var(--gray-5)', margin: '0 4px' }} />
      <IconButton 
        size="1" 
        variant={editor.isActive('bulletList') ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
      >
        <List size={14} />
      </IconButton>
      <IconButton 
        size="1" 
        variant={editor.isActive('orderedList') ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
      >
        <ListOrdered size={14} />
      </IconButton>
      <div style={{ width: '1px', background: 'var(--gray-5)', margin: '0 4px' }} />
      <IconButton 
        size="1" 
        variant={editor.isActive('link') ? 'solid' : 'ghost'} 
        onClick={(e) => { e.preventDefault(); toggleLink() }}
      >
        <LinkIcon size={14} />
      </IconButton>
      <IconButton 
        size="1" 
        variant="ghost" 
        onClick={(e) => { e.preventDefault(); addImage() }}
      >
        <ImageIcon size={14} />
      </IconButton>
    </Flex>
  );
};

const WysiwygMarkdownEditor = ({ content, onChange, onBlur, minHeight = '150px', readOnly = false, height = 'auto' }) => {
  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      // Retorna Markdown puro
      onChange(editor.storage.markdown.getMarkdown());
    },
    onBlur: ({ editor }) => {
      if (onBlur) onBlur();
    }
  });

  // Re-sync if external content changes
  useEffect(() => {
    if (editor && typeof content === 'string') {
       const currentMarkdown = editor.storage.markdown.getMarkdown();
       if (content !== currentMarkdown && !editor.isFocused) {
          editor.commands.setContent(content);
       }
    }
  }, [content, editor]);

  return (
    <Box style={{ border: '1px solid var(--gray-5)', 
      borderRadius: 'var(--radius-3)',
      display: 'flex',
      flexDirection: 'column',
      background: readOnly ? 'var(--gray-2)' : 'var(--surface)',
      height: height
    }}>
      {!readOnly && <MenuBar editor={editor} />}
      <Box className="editor-content-wrapper markdown-body" style={{ flexGrow: 1, padding: '16px', minHeight, overflowY: 'auto' }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
};

export default WysiwygMarkdownEditor;
