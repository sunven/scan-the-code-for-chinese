import { useState, useMemo } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { FolderOpen, Play, ChevronRight, Expand, Minimize, FileText, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ScanResult {
  filePath: string
  line: number
  column: number
  text: string
}

type GroupedResults = Record<string, ScanResult[]>

function App() {
  const [scanPath, setScanPath] = useState('')
  const [excludePatterns, setExcludePatterns] = useState('')
  const [results, setResults] = useState<ScanResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({})

  const groupedResults = useMemo(() => {
    return results.reduce((acc, result) => {
      const { filePath } = result
      if (!acc[filePath]) {
        acc[filePath] = []
      }
      acc[filePath].push(result)
      return acc
    }, {} as GroupedResults)
  }, [results])

  const toggleFileExpansion = (filePath: string) => {
    setExpandedFiles(prev => ({ ...prev, [filePath]: !prev[filePath] }))
  }

  const expandAll = () => {
    const allFilePaths = Object.keys(groupedResults)
    const newExpansionState = allFilePaths.reduce((acc, path) => {
      acc[path] = true
      return acc
    }, {} as Record<string, boolean>)
    setExpandedFiles(newExpansionState)
  }

  const collapseAll = () => {
    setExpandedFiles({})
  }

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
    setExpandedFiles({})

    try {
      const res = await invoke<ScanResult[]>('scan_directory', {
        path: scanPath,
        exclude: excludePatterns,
      })
      setResults(res)
      // Automatically expand all files by default after scan
      expandAll()
    } catch (err: any) {
      setError(`An error occurred during scan: ${err.toString()}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <header className="text-center">
          <h4 className="text-2xl font-bold text-primary mb-2">Scan the code for Chinese</h4>
          <p className="text-muted-foreground">
            A high-performance code scanning tool built with Tauri, React, and Oxc.
          </p>
        </header>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>扫描配置</CardTitle>
                <CardDescription>选择要扫描的代码目录和排除规则</CardDescription>
              </div>
              <Button onClick={startScan} disabled={isLoading}>
                <Play />
                {isLoading ? '扫描中...' : '开始扫描'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 items-center">
              <Label className="w-20" htmlFor="scanPath">
                代码目录
              </Label>
              <div className="flex-1 flex items-center gap-2">
                <Input
                  id="scanPath"
                  value={scanPath}
                  onChange={e => setScanPath(e.target.value)}
                  placeholder="选择或输入要扫描的代码目录..."
                />
                <Button onClick={selectDirectory} variant="outline">
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Label className="w-20 shrink-0 flex items-center gap-2" htmlFor="excludePatterns">
                Exclude
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      逗号分隔的文件或目录列表，用于排除扫描。
                      <br />
                      例如: node_modules,dist
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input id="excludePatterns" value={excludePatterns} onChange={e => setExcludePatterns(e.target.value)} />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md">
                <p>
                  <strong>错误:</strong> {error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText />
              扫描结果
            </CardTitle>
            {results.length > 0 && (
              <CardDescription className="mt-1">共找到 {results.length} 处中文内容</CardDescription>
            )}
          </div>
          {results.length > 0 && (
            <div className="flex space-x-2">
              <Button onClick={expandAll} variant="outline" size="sm">
                <Expand />
                全部展开
              </Button>
              <Button onClick={collapseAll} variant="outline" size="sm">
                <Minimize />
                全部折叠
              </Button>
            </div>
          )}
        </div>
        <div className="bg-card border rounded-md">
          {Object.keys(groupedResults).length > 0 ? (
            <div>
              {Object.entries(groupedResults).map(([filePath, items]) => (
                <div key={filePath} className="border-b border-border last:border-b-0">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer"
                    onClick={() => toggleFileExpansion(filePath)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${expandedFiles[filePath] ? 'rotate-90' : ''}`}
                      />
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm text-foreground">{filePath}</span>
                    </div>
                    <span className="bg-muted text-muted-foreground text-xs font-semibold px-2.5 py-0.5 rounded-md">
                      {items.length}
                    </span>
                  </div>
                  {expandedFiles[filePath] && (
                    <div className="px-3 pb-3">
                      <div className="bg-muted/30 rounded-md overflow-hidden">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr className="text-left text-muted-foreground">
                              <th className="p-2 w-20">行号</th>
                              <th className="p-2 w-20">列号</th>
                              <th className="p-2">文本内容</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {items.map((item, index) => (
                              <tr key={index} className="">
                                <td className="p-2 font-mono text-muted-foreground">{item.line}</td>
                                <td className="p-2 font-mono text-muted-foreground">{item.column}</td>
                                <td className="p-2 font-mono text-muted-foreground">{item.text}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground p-8">{isLoading ? '正在加载结果...' : '暂无结果。'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
