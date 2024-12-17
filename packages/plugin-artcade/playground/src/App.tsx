import React, { useEffect, useState } from 'react';
import { Box, Container, Grid, Paper } from '@mui/material';
import PatternPreview from './components/PatternPreview';
import EmbeddingVisualizer from './components/EmbeddingVisualizer';
import MetricsPanel from './components/MetricsPanel';
import Controls from './components/Controls';
import { patternService } from './services/PG-PatternService';
import { GamePattern } from '../../src/types/patterns';
import { PatternEffectivenessMetrics } from '../../src/types/effectiveness';

const App: React.FC = () => {
  const [patterns, setPatterns] = useState<GamePattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<GamePattern | null>(null);
  const [metrics, setMetrics] = useState<PatternEffectivenessMetrics | null>(null);

  useEffect(() => {
    const initializePatterns = async () => {
      await patternService.initialize();
      const loadedPatterns = await patternService.getPatterns();
      setPatterns(loadedPatterns);
      if (loadedPatterns.length > 0) {
        setSelectedPattern(loadedPatterns[0]);
      }
    };
    initializePatterns();
  }, []);

  useEffect(() => {
    const loadMetrics = async () => {
      if (selectedPattern) {
        const patternMetrics = await patternService.getPatternMetrics(selectedPattern.id);
        setMetrics(patternMetrics);
      }
    };
    loadMetrics();
  }, [selectedPattern]);

  const handleEvolve = async () => {
    if (selectedPattern) {
      const similarPatterns = await patternService.searchSimilarPatterns(selectedPattern);
      console.log('Similar patterns:', similarPatterns);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Pattern Preview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '500px' }}>
            <PatternPreview
              html={selectedPattern?.content.html}
              css={selectedPattern?.content.css}
              js={selectedPattern?.content.js}
            />
          </Paper>
        </Grid>

        {/* Embedding Visualizer */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '500px' }}>
            <EmbeddingVisualizer
              embeddings={patterns.map(p => ({
                id: p.id,
                vector: p.embedding || [0, 0],
                label: p.pattern_name,
                type: p.type
              }))}
            />
          </Paper>
        </Grid>

        {/* Controls */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Controls
              onEvolve={handleEvolve}
              onReset={() => setSelectedPattern(patterns[0])}
              onParameterChange={(param, value) => {
                console.log('Parameter changed:', param, value);
              }}
            />
          </Paper>
        </Grid>

        {/* Metrics Panel */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <MetricsPanel
              metrics={metrics ? {
                visual: metrics.quality_scores.visual,
                interactive: metrics.quality_scores.interactive,
                functional: metrics.quality_scores.functional,
                performance: metrics.quality_scores.performance,
                accessibility: 0.5,
                codeQuality: 0.5
              } : undefined}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default App;
