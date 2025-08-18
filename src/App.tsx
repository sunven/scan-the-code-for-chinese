import { useState, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

interface ScanResult {
  filePath: string;
  line: number;
  column: number;
  text: string;
}

type GroupedResults = Record<string, ScanResult[]>;

function App() {
  const [scanPath, setScanPath] = useState('');
  const [excludePatterns, setExcludePatterns] = useState('');
  const [results, setResults] = useState<ScanResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  const groupedResults = useMemo(() => {
    return results.reduce((acc, result) => {
      const { filePath } = result;
      if (!acc[filePath]) {
        acc[filePath] = [];
      }
      acc[filePath].push(result);
      return acc;
    }, {} as GroupedResults);
  }, [results]);

  const toggleFileExpansion = (filePath: string) => {
    setExpandedFiles(prev => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const expandAll = () => {
    const allFilePaths = Object.keys(groupedResults);
    const newExpansionState = allFilePaths.reduce((acc, path) => {
      acc[path] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedFiles(newExpansionState);
  };

  const collapseAll = () => {
    setExpandedFiles({});
  };

  const selectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (typeof selected === 'string') {
        setScanPath(selected);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to open directory dialog.');
    }
  };

  const startScan = async () => {
    if (!scanPath) {
      setError('Please select a directory to scan.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResults([]);
    setExpandedFiles({});

    try {
      const res = await invoke<ScanResult[]>('scan_directory', {
        path: scanPath,
        exclude: excludePatterns,
      });
      setResults(res);
      // Automatically expand all files by default after scan
      expandAll();
    } catch (err: any) {
      setError(`An error occurred during scan: ${err.toString()}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-cyan-400">代码中文扫描工具</h1>
          <p className="text-gray-400 mt-2">
            使用 Tauri, React, Oxc 构建的高性能代码扫描工具
          </p>
        </header>

        <main className="bg-gray-800 p-6 rounded-lg shadow-lg">
          {/* ... (Input and button sections remain the same) ... */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2">
              <label htmlFor="scanPath" className="block text-sm font-medium text-gray-300 mb-2">
                代码目录
              </label>
              <div className="flex">
                <input
                  id="scanPath"
                  type="text"
                  value={scanPath}
                  onChange={(e) => setScanPath(e.target.value)}
                  placeholder="选择或输入要扫描的代码目录..."
                  className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md p-2 focus:ring-cyan-500 focus:border-cyan-500"
                />
                <button
                  onClick={selectDirectory}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-r-md"
                >
                  选择
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="excludePatterns" className="block text-sm font-medium text-gray-300 mb-2">
                排除目录 (逗号分隔)
              </label>
              <input
                id="excludePatterns"
                type="text"
                value={excludePatterns}
                onChange={(e) => setExcludePatterns(e.target.value)}
                placeholder="例如: node_modules,dist"
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={startScan}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {isLoading ? '扫描中...' : '开始扫描'}
            </button>
          </div>

          {error && (
            <div className="mt-6 bg-red-900 border border-red-700 text-red-200 p-4 rounded-md">
              <p><strong>错误:</strong> {error}</p>
            </div>
          )}

          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-200">扫描结果</h2>
              {results.length > 0 && (
                <div className="flex space-x-2">
                  <button onClick={expandAll} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 px-3 rounded-md">全部展开</button>
                  <button onClick={collapseAll} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 px-3 rounded-md">全部折叠</button>
                </div>
              )}
            </div>
            <div className="bg-gray-900 rounded-lg overflow-hidden max-h-[32rem] overflow-y-auto">
              {Object.keys(groupedResults).length > 0 ? (
                <div>
                  {Object.entries(groupedResults).map(([filePath, items]) => (
                    <div key={filePath} className="border-b border-gray-700">
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800"
                        onClick={() => toggleFileExpansion(filePath)}
                      >
                        <div className="flex items-center">
                           <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 mr-2 transition-transform transform ${expandedFiles[filePath] ? 'rotate-90' : ''}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="font-mono text-cyan-400">{filePath}</span>
                        </div>
                        <span className="bg-gray-700 text-gray-300 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">
                          {items.length}
                        </span>
                      </div>
                      {expandedFiles[filePath] && (
                        <div className="pl-5 pr-2 pb-2">
                          <table className="min-w-full text-sm">
                            <thead className="text-left text-gray-400">
                              <tr>
                                <th className="p-2 w-24">行号</th>
                                <th className="p-2 w-24">列号</th>
                                <th className="p-2">文本内容</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                              {items.map((item, index) => (
                                <tr key={index} className="bg-gray-800/50">
                                  <td className="p-2 font-mono">{item.line}</td>
                                  <td className="p-2 font-mono">{item.column}</td>
                                  <td className="p-2 text-gray-300 bg-gray-700/50 rounded font-mono">{item.text}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 p-8">
                  {isLoading ? '正在加载结果...' : '暂无结果。'}
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;