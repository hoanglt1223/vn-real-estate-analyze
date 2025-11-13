export async function analyzeProperty(data: {
  coordinates: number[][];
  radius: number;
  categories: string[];
  layers: string[];
}) {
  const response = await fetch('/api/analyze-property', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to analyze property');
  }

  return response.json();
}

export async function getAnalysis(id: string) {
  const response = await fetch(`/api/analysis/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch analysis');
  }

  return response.json();
}

export async function getRecentAnalyses(limit: number = 10) {
  const response = await fetch(`/api/recent-analyses?limit=${limit}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch recent analyses');
  }

  return response.json();
}
