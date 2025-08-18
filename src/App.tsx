import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import './App.css'

interface ScanResult {
  filePath: string
  line: number
  column: number
  text: string
}

function App() {
  const [scanPath, setScanPath] = useState(`C:\\Users\\Administrator\\Desktop\\gemini-cli-demo\\chinese-scanner\\src`)
  const [excludePatterns, setExcludePatterns] = useState('')
  const [results, setResults] = useState<ScanResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      })
      if (typeof selected === 'string') {
        setScanPath(selected)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to open directory dialog.')
    }
  }

  const startScan = async () => {
    if (!scanPath) {
      setError('Please select a directory to scan.')
      return
    }
    setIsLoading(true)
    setError(null)
    setResults([])

    try {
      const res = await invoke<ScanResult[]>('scan_directory', {
        path: scanPath,
        exclude: excludePatterns,
      })
      setResults(res)
      console.log(res)
    } catch (err: any) {
      setError(`An error occurred during scan: ${err.toString()}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-cyan-400">代码中文扫描工具</h1>
          <p className="text-gray-400 mt-2">使用 Tauri, React, Oxc 构建的高性能代码扫描工具</p>
        </header>

        <main className="bg-gray-800 p-6 rounded-lg shadow-lg">
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
                  onChange={e => setScanPath(e.target.value)}
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
                onChange={e => setExcludePatterns(e.target.value)}
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
              <p>
                <strong>错误:</strong> {error}
              </p>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-200 mb-4">扫描结果</h2>
            <div className="bg-gray-900 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              {results.length > 0 ? (
                <ul className="divide-y divide-gray-700">
                  {results.map((result, index) => (
                    <li key={index} className="p-4 hover:bg-gray-800">
                      <p className="font-mono text-sm text-cyan-400">
                        {result.filePath}:{result.line}:{result.column}
                      </p>
                      <p className="mt-1 text-gray-300 bg-gray-700 p-2 rounded">{result.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-500 p-8">{isLoading ? '正在加载结果...' : '暂无结果。'}</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
