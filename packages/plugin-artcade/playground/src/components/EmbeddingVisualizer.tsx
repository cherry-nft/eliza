import React from 'react';
import { Box, Typography } from '@mui/material';
import Plot from 'react-plotly.js';

interface EmbeddingVisualizerProps {
  embeddings?: Array<{
    id: string;
    vector: number[];
    label: string;
    type: string;
  }>;
}

const EmbeddingVisualizer: React.FC<EmbeddingVisualizerProps> = ({ embeddings = [] }) => {
  // Convert embeddings to plotly format using PCA or t-SNE
  // For now, we'll just use the first two dimensions
  const data = embeddings.map(embedding => ({
    x: [embedding.vector[0]],
    y: [embedding.vector[1]],
    type: 'scatter',
    mode: 'markers+text',
    name: embedding.type,
    text: [embedding.label],
    textposition: 'top center',
    marker: { size: 10 }
  }));

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Pattern Space
      </Typography>
      <Box sx={{ flexGrow: 1 }}>
        <Plot
          data={data as any}
          layout={{
            autosize: true,
            showlegend: true,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 0, r: 0, b: 30, l: 30 },
            xaxis: {
              showgrid: true,
              zeroline: true,
              showline: true,
              gridcolor: 'rgba(255,255,255,0.1)',
              zerolinecolor: 'rgba(255,255,255,0.2)',
            },
            yaxis: {
              showgrid: true,
              zeroline: true,
              showline: true,
              gridcolor: 'rgba(255,255,255,0.1)',
              zerolinecolor: 'rgba(255,255,255,0.2)',
            },
            font: {
              color: '#fff'
            }
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
    </Box>
  );
};

export default EmbeddingVisualizer;
