import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';

interface PatternPreviewProps {
  html?: string;
  css?: string;
  js?: string;
}

const PatternPreview: React.FC<PatternPreviewProps> = ({ html = '', css = '', js = '' }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <style>${css}</style>
            </head>
            <body>
              ${html}
              <script>${js}</script>
            </body>
          </html>
        `);
        doc.close();
      }
    }
  }, [html, css, js]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Pattern Preview
      </Typography>
      <Box sx={{ flexGrow: 1, border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 1, overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          title="pattern-preview"
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts"
        />
      </Box>
    </Box>
  );
};

export default PatternPreview;
