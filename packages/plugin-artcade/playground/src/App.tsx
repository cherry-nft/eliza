import React from 'react';
import { Box, Container, Grid, Paper } from '@mui/material';
import PatternPreview from './components/PatternPreview';
import EmbeddingVisualizer from './components/EmbeddingVisualizer';
import MetricsPanel from './components/MetricsPanel';
import Controls from './components/Controls';

const App: React.FC = () => {
  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Pattern Preview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '500px' }}>
            <PatternPreview />
          </Paper>
        </Grid>

        {/* Embedding Visualizer */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '500px' }}>
            <EmbeddingVisualizer />
          </Paper>
        </Grid>

        {/* Controls */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Controls />
          </Paper>
        </Grid>

        {/* Metrics Panel */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <MetricsPanel />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default App;
