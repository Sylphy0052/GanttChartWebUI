'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    setResult('Loading...');
    
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      console.log('Testing API_BASE_URL:', API_BASE_URL);
      
      const response = await fetch(`${API_BASE_URL}/projects`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      setResult(`✅ Success!
Status: ${response.status}
Data: ${JSON.stringify(data, null, 2)}
API_BASE_URL: ${API_BASE_URL}`);
      
    } catch (error: any) {
      console.error('API test error:', error);
      setResult(`❌ Error: ${error.message}
API_BASE_URL: ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
Error details: ${JSON.stringify(error, null, 2)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">API Debug Page</h1>
        
        <div className="mb-4">
          <button 
            onClick={testAPI}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test API Connection'}
          </button>
        </div>
        
        <div className="bg-white p-4 border rounded">
          <h3 className="font-bold mb-2">Environment Variables:</h3>
          <pre className="text-sm bg-gray-100 p-2 rounded mb-4">
            NEXT_PUBLIC_API_URL: {process.env.NEXT_PUBLIC_API_URL || 'undefined'}
          </pre>
          
          <h3 className="font-bold mb-2">Test Result:</h3>
          <pre className="text-sm bg-gray-100 p-2 rounded whitespace-pre-wrap">
            {result || 'Click "Test API Connection" to start'}
          </pre>
        </div>
      </div>
    </div>
  );
}