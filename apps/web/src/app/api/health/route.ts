import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Next.js Web Application
 * This endpoint is used by Docker health checks and load balancers
 */

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  service: string;
  environment: string;
  api: {
    status: string;
    url: string;
    error?: string;
  };
}

let startTime = Date.now();

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  let apiStatus = 'unknown';
  let apiError: string | undefined;

  // Test API connectivity
  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      apiStatus = 'connected';
    } else {
      apiStatus = 'error';
      apiError = `HTTP ${response.status}`;
    }
  } catch (error) {
    apiStatus = 'error';
    apiError = error instanceof Error ? error.message : 'Connection failed';
  }

  const healthResponse: HealthResponse = {
    status: apiStatus === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
    service: 'gantt-chart-web',
    environment: process.env.NODE_ENV || 'unknown',
    api: {
      status: apiStatus,
      url: apiUrl,
      ...(apiError && { error: apiError }),
    },
  };

  // Return appropriate status code
  const statusCode = apiStatus === 'connected' ? 200 : 503;
  
  return NextResponse.json(healthResponse, { status: statusCode });
}