'use client';

import { useState } from 'react';
import { Upload, Activity, TrendingUp, AlertCircle } from 'lucide-react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [aggregates, setAggregates] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    try {
      // Create or get restaurant
      const restaurantRes = await fetch('http://localhost:3001/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Restaurant' }),
      });
      const restaurant = await restaurantRes.json();
      setRestaurantId(restaurant.id);

      // Upload CSV
      const formData = new FormData();
      formData.append('file', file);
      formData.append('restaurantId', restaurant.id.toString());

      const uploadRes = await fetch('http://localhost:3001/api/upload-csv', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadRes.json();
      console.log('Upload result:', uploadResult);

      // Fetch analytics
      await fetchAnalytics(restaurant.id);

      alert('CSV uploaded and processed successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };

  const fetchAnalytics = async (restId: number) => {
    try {
      const res = await fetch(`http://localhost:3001/api/analytics/comprehensive?restaurantId=${restId}`);
      const data = await res.json();
      setInsights(data.insights || []);
      setAggregates(data.aggregates || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Restaurant Intelligence Platform
          </h1>
          <p className="text-slate-600">
            Upload your POS data and get AI-powered insights
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-4">
            <Upload className="w-8 h-8 text-slate-600" />
            <div className="flex-1">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Processing...' : 'Upload & Analyze'}
            </button>
          </div>
        </div>

        {/* Insights Section */}
        {insights.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-6 h-6" />
              Insights
            </h2>
            <div className="space-y-4">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`rounded-lg border-2 p-6 ${getSeverityColor(insight.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {insight.observation}
                      </h3>
                      <p className="mb-4 opacity-90">
                        {insight.explanation}
                      </p>

                      {/* Causal Factors */}
                      {insight.causalFactors && (
                        <div className="mb-4">
                          <p className="font-medium text-sm mb-2">Contributing Factors:</p>
                          <div className="space-y-1">
                            {JSON.parse(insight.causalFactors).map((factor: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className={`px-2 py-1 rounded ${
                                  factor.direction === 'positive' ? 'bg-green-100' : 'bg-red-100'
                                }`}>
                                  {factor.direction === 'positive' ? '+' : ''}
                                  {factor.contributionPct.toFixed(1)}%
                                </span>
                                <span>{factor.factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Formula */}
                      {insight.formula && (
                        <details className="mb-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            Show mathematical breakdown
                          </summary>
                          <pre className="mt-2 p-3 bg-white bg-opacity-50 rounded text-xs overflow-x-auto">
                            {insight.formula}
                          </pre>
                        </details>
                      )}

                      {/* Recommendation */}
                      {insight.recommendation && (
                        <div className="mt-4 p-4 bg-white bg-opacity-50 rounded-md">
                          <p className="font-medium text-sm mb-1">Recommended Action:</p>
                          <p className="text-sm">{insight.recommendation}</p>
                        </div>
                      )}

                      {/* Confidence */}
                      <div className="mt-3 flex items-center gap-4 text-xs opacity-75">
                        <span>
                          Confidence: {(insight.confidenceScore * 100).toFixed(0)}%
                        </span>
                        <span>
                          Sample Size: {insight.sampleSize} orders
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Trend Chart */}
        {aggregates.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              Revenue Trend
            </h2>
            <div className="h-64 flex items-end gap-2">
              {aggregates.slice(0, 14).reverse().map((agg, idx) => {
                const maxRevenue = Math.max(...aggregates.map(a => a.totalRevenue));
                const height = (agg.totalRevenue / maxRevenue) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`₹${agg.totalRevenue.toFixed(0)}`}
                    />
                    <span className="text-xs text-slate-500 rotate-45 origin-top-left mt-2">
                      {new Date(agg.periodStart).toLocaleDateString('en-IN', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!restaurantId && (
          <div className="text-center py-16 text-slate-500">
            <Upload className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Upload a CSV file to get started</p>
            <p className="text-sm mt-2">Your data will be analyzed automatically</p>
          </div>
        )}
      </div>
    </div>
  );
}