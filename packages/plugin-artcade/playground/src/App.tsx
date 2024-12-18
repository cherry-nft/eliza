import React, { useEffect, useState } from 'react';
import { Box, Container, Grid, Paper } from '@mui/material';
import PatternPreview from './components/PatternPreview';
import EmbeddingVisualizer from './components/EmbeddingVisualizer';
import MetricsPanel from './components/MetricsPanel';
import Controls from './components/Controls';
import PromptInput from './components/PromptInput';
import { clientPatternService } from './services/ClientPatternService';
import { GamePattern } from '../../src/types/patterns';
import { PatternEffectivenessMetrics } from '../../src/types/effectiveness';

interface ClaudeOutput {
    plan: {
        coreMechanics: string[];
        visualElements: string[];
        interactionFlow: Array<{
            trigger: string;
            action: string;
            description: string;
        }>;
        stateManagement: string[];
        assetRequirements: string[];
    };
    title: string;
    description: string;
    html: string;
    thumbnail: {
        alt: string;
        backgroundColor: string;
        elements: Array<{
            type: "rect" | "circle" | "path";
            attributes: Record<string, string>;
        }>;
    };
}

interface EvolutionParameters {
  mutationRate: number;
  populationSize: number;
  patternType: GamePattern["type"];
}

const validateEvolutionParams = (params: EvolutionParameters): string[] => {
  const errors: string[] = [];
  if (params.mutationRate < 0 || params.mutationRate > 1) {
    errors.push('Mutation rate must be between 0 and 1');
  }
  if (params.populationSize < 5 || params.populationSize > 50) {
    errors.push('Population size must be between 5 and 50');
  }
  if (!["animation", "layout", "interaction", "style", "game_mechanic"].includes(params.patternType)) {
    errors.push('Invalid pattern type');
  }
  return errors;
};

const App: React.FC = () => {
  console.log('App component rendering');

  const [patterns, setPatterns] = useState<GamePattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<GamePattern | null>(null);
  const [claudeOutput, setClaudeOutput] = useState<ClaudeOutput | null>(null);
  const [metrics, setMetrics] = useState<PatternEffectivenessMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [evolutionParams, setEvolutionParams] = useState<EvolutionParameters>({
    mutationRate: 0.3,
    populationSize: 10,
    patternType: "game_mechanic"
  });
  const [evolutionErrors, setEvolutionErrors] = useState<string[]>([]);

  // Validate evolution parameters when they change
  useEffect(() => {
    console.log('Evolution parameters changed:', evolutionParams);
    const errors = validateEvolutionParams(evolutionParams);
    setEvolutionErrors(errors);
  }, [evolutionParams]);

  useEffect(() => {
    console.log('Initial useEffect running');
    const initializePatterns = async () => {
      console.log('Initializing patterns');
      const isHealthy = await clientPatternService.healthCheck();
      if (!isHealthy) {
        console.error('Pattern service health check failed');
        return;
      }
      const loadedPatterns = await clientPatternService.getAllPatterns();
      console.log('Loaded patterns:', loadedPatterns);
      setPatterns(loadedPatterns);
      if (loadedPatterns.length > 0) {
        console.log('Setting initial selected pattern:', loadedPatterns[0]);
        setSelectedPattern(loadedPatterns[0]);
      }
    };
    initializePatterns();
  }, []);

  useEffect(() => {
    console.log('Selected pattern changed:', selectedPattern);
  }, [selectedPattern]);

  useEffect(() => {
    console.log('Claude output changed:', claudeOutput);
  }, [claudeOutput]);

  useEffect(() => {
    console.log('Metrics changed:', metrics);
  }, [metrics]);

  const handlePromptSubmit = async (prompt: string) => {
    console.log('Handling prompt submit:', prompt);
    setLoading(true);
    try {
      console.log('Generating pattern from prompt');
      const response = await clientPatternService.generatePattern(prompt);
      console.log('Generated pattern response:', response);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to generate pattern');
      }

      const isValidClaudeOutput = (data: any): data is ClaudeOutput => {
        return (
          data &&
          typeof data === 'object' &&
          'plan' in data &&
          'title' in data &&
          'description' in data &&
          'html' in data &&
          'thumbnail' in data &&
          typeof data.plan === 'object' &&
          Array.isArray(data.plan.coreMechanics)
        );
      };

      if (!isValidClaudeOutput(response.data)) {
        throw new Error('Invalid pattern data structure received');
      }

      setClaudeOutput(response.data);

      if (patterns.length > 0) {
        console.log('Creating game pattern from Claude output');
        const generatedGamePattern: GamePattern = {
          id: 'generated',
          type: 'game_mechanic',
          pattern_name: response.data.title,
          content: {
            html: response.data.html,
            context: 'game',
            metadata: {
              game_mechanics: response.data.plan.coreMechanics.map((mechanic: string) => ({
                type: mechanic,
                properties: {} as Record<string, any>
              }))
            }
          },
          embedding: [],
          effectiveness_score: 1.0,
          usage_count: 0
        };
        console.log('Created game pattern:', generatedGamePattern);

        console.log('Searching for similar patterns');
        const similarPatterns = await clientPatternService.searchSimilarPatterns(generatedGamePattern);
        console.log('Found similar patterns:', similarPatterns);

        if (similarPatterns.length > 0) {
          console.log('Setting selected pattern:', similarPatterns[0]);
          setSelectedPattern(similarPatterns[0]);

          console.log('Comparing patterns');
          const metrics = await clientPatternService.comparePatterns(response.data.html, similarPatterns[0]);
          console.log('Pattern comparison metrics:', metrics);
          setMetrics(metrics);
        }
      }
    } catch (error) {
      console.error('Error processing prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvolvePattern = async () => {
    console.log('Starting pattern evolution process');
    if (!claudeOutput) {
      console.error('Evolution failed: No Claude output to evolve');
      return;
    }

    const errors = validateEvolutionParams(evolutionParams);
    if (errors.length > 0) {
      console.error('Evolution failed: Invalid parameters:', errors);
      return;
    }

    setLoading(true);
    try {
      console.log('Creating pattern for evolution with params:', evolutionParams);
      const currentPattern: GamePattern = {
        id: 'current',
        type: selectedPattern?.type || evolutionParams.patternType,
        pattern_name: claudeOutput.title,
        content: {
          html: claudeOutput.html,
          context: 'evolution',
          metadata: {
            game_mechanics: claudeOutput.plan.coreMechanics.map((mechanic: string) => ({
              type: mechanic,
              properties: {} as Record<string, any>
            })),
            evolution: {
              parent_pattern_id: selectedPattern?.id || 'root',
              applied_patterns: [],
              mutation_type: evolutionParams.patternType,
              fitness_scores: {}
            }
          }
        },
        embedding: [],
        effectiveness_score: selectedPattern?.effectiveness_score || 0,
        usage_count: 0
      };
      console.log('Created base pattern for evolution:', currentPattern);

      console.log('Starting evolution with parameters:', evolutionParams);
      const evolvedPattern = await clientPatternService.evolvePattern(currentPattern, evolutionParams);
      console.log('Evolution complete. Evolved pattern:', evolvedPattern);

      if (evolvedPattern.content.metadata.evolution?.fitness_scores) {
        console.log('Evolution fitness scores:', evolvedPattern.content.metadata.evolution.fitness_scores);
      }

      console.log('Updating Claude output with evolved pattern');
      setClaudeOutput({
        ...claudeOutput,
        html: evolvedPattern.content.html
      });

      console.log('Searching for similar patterns to evolved pattern');
      const similarPatterns = await clientPatternService.searchSimilarPatterns(evolvedPattern);
      console.log('Found similar patterns:', similarPatterns.length);
      console.log('Similar patterns:', similarPatterns);

      if (similarPatterns.length > 0) {
        console.log('Setting selected pattern to most similar:', similarPatterns[0]);
        setSelectedPattern(similarPatterns[0]);

        console.log('Comparing evolved pattern with selected similar pattern');
        const metrics = await clientPatternService.comparePatterns(evolvedPattern.content.html, similarPatterns[0]);
        console.log('Evolution comparison metrics:', metrics);
        setMetrics(metrics);
      }
    } catch (error) {
      console.error('Evolution process failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Prompt Input */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <PromptInput onSubmit={handlePromptSubmit} loading={loading} />
          </Paper>
        </Grid>

        {/* Controls */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Controls
              selectedPattern={selectedPattern}
              onEvolve={handleEvolvePattern}
              evolutionErrors={evolutionErrors}
              onReset={() => {
                console.log('Resetting to default state');
                setClaudeOutput(null);
                setSelectedPattern(patterns[0]);
                setEvolutionParams({
                  mutationRate: 0.3,
                  populationSize: 10,
                  patternType: "game_mechanic"
                });
              }}
              onParameterChange={(param, value) => {
                console.log('Parameter change requested:', { param, value });
                if (param === 'type' && selectedPattern) {
                  const newType = value as GamePattern['type'];
                  console.log('Updating pattern type:', newType);
                  setSelectedPattern({
                    ...selectedPattern,
                    type: newType
                  });
                  setEvolutionParams(prev => ({
                    ...prev,
                    patternType: newType
                  }));
                } else if (param === 'mutationRate') {
                  console.log('Updating mutation rate:', value);
                  setEvolutionParams(prev => ({
                    ...prev,
                    mutationRate: value as number
                  }));
                } else if (param === 'populationSize') {
                  console.log('Updating population size:', value);
                  setEvolutionParams(prev => ({
                    ...prev,
                    populationSize: value as number
                  }));
                }
              }}
            />
          </Paper>
        </Grid>

        {/* Preview Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, minHeight: '500px' }}>
            <Box sx={{ mb: 2 }}>
              <h3>{claudeOutput?.title || 'Claude Output'}</h3>
              <p>{claudeOutput?.description}</p>
            </Box>
            <PatternPreview
              html={claudeOutput?.html || '<!-- Generated HTML will appear here -->'}
            />
          </Paper>
        </Grid>

        {/* Similar Pattern Preview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, minHeight: '500px' }}>
            <Box sx={{ mb: 2 }}>
              <h3>Similar Pattern</h3>
            </Box>
            <PatternPreview
              html={selectedPattern?.content.html}
              css={selectedPattern?.content.css}
              js={selectedPattern?.content.js}
            />
          </Paper>
        </Grid>

        {/* Pattern Space Visualization */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '400px' }}>
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

        {/* Comparison & Feedback */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <MetricsPanel
              metrics={metrics ? {
                visual: metrics.quality_scores.visual,
                interactive: metrics.quality_scores.interactive,
                functional: metrics.quality_scores.functional,
                performance: metrics.quality_scores.performance,
                accessibility: metrics.quality_scores.accessibility,
                codeQuality: metrics.quality_scores.code_quality
              } : undefined}
            />
            <Controls
              selectedPattern={selectedPattern}
              onEvolve={handleEvolvePattern}
              evolutionErrors={evolutionErrors}
              onParameterChange={(param, value) => {
                console.log('Parameter changed in second Controls:', param, value);
                if (param === 'type' && selectedPattern) {
                  const newType = value as GamePattern['type'];
                  setSelectedPattern({
                    ...selectedPattern,
                    type: newType
                  });
                  setEvolutionParams(prev => ({
                    ...prev,
                    patternType: newType
                  }));
                } else if (param === 'mutationRate') {
                  setEvolutionParams(prev => ({
                    ...prev,
                    mutationRate: value as number
                  }));
                } else if (param === 'populationSize') {
                  setEvolutionParams(prev => ({
                    ...prev,
                    populationSize: value as number
                  }));
                }
              }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default App;
