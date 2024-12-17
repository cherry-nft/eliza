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
        // If html contains a complete document, use it directly
        if (html.includes('<!DOCTYPE html>') || html.includes('<html')) {
          doc.write(html);
        } else {
          // Otherwise, wrap it in a document
          doc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  ${css}
                  /* Ensure content is contained */
                  html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: auto;
                  }
                  /* Add a container for game content */
                  #game-container {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    overflow: hidden;
                  }
                </style>
              </head>
              <body>
                <div id="game-container">
                  ${html}
                </div>
                <script>${js}</script>
              </body>
            </html>
          `);
        }
        doc.close();
      }
    }
  }, [html, css, js]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Pattern Preview
      </Typography>
      <Box sx={{
        flexGrow: 1,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 1,
        overflow: 'hidden',
        height: '800px', // Fixed height
        maxHeight: '800px', // Maximum height
        maxWidth: '100%',
        position: 'relative' // For proper iframe sizing
      }}>
        <iframe
          ref={iframeRef}
          title="pattern-preview"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: 'white',
            position: 'absolute', // Fill the container
            top: 0,
            left: 0
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      </Box>
    </Box>
  );
};

export default PatternPreview;
