import type { AnalysisResult } from '$lib/stores/app';

export async function analyzeImage(base64Image: string, salient: boolean = false): Promise<AnalysisResult> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, salient })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Analysis failed' }));
    throw new Error(err.message || 'Analysis failed');
  }

  return response.json();
}
