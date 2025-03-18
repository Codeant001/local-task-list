import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node as FlowNode,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  NodeTypes,
  Connection,
  OnConnectStart,
  OnConnectEnd,
  ReactFlowProvider,
  useReactFlow,
  NodeMouseHandler,
  EdgeTypes,
  EdgeProps,
  getBezierPath,
  Position,
  NodeChange,
  NodePositionChange,
  EdgeChange,
  ConnectionLineType,
  ConnectionMode,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { Button, Space, Modal, Form, Input, Select, Tooltip, Divider, message, Switch, Dropdown, Drawer } from 'antd';
import { 
  PlusOutlined, 
  LayoutOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  UndoOutlined, 
  RedoOutlined,
  SaveOutlined,
  UploadOutlined,
  FileOutlined,
  FileAddOutlined,
  HistoryOutlined,
  LockOutlined,
  UnlockOutlined,
  SettingOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { MindMapData, MindMapNode, MindMapTheme } from '../types/MindMap';
import { saveToFile, loadFromFile, saveToMarkdown } from '../utils/fileUtils';
import CustomNode from './CustomNode';
// 导入wangEditor相关组件
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor';

const { Option } = Select;

// 简化的 File System Access API 类型定义
interface FileSystemDirectoryHandle {
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

// 检查是否支持目录选择器
const isDirectoryPickerSupported = (): boolean => {
  return 'showDirectoryPicker' in window;
};

// 添加全局样式
const GlobalStyles = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes flow {
        from {
          stroke-dashoffset: 10;
        }
        to {
          stroke-dashoffset: 0;
        }
      }
      
      .react-flow__edge-path {
        pointer-events: all;
      }
      
      .react-flow__handle {
        opacity: 0.6;
        transition: opacity 0.2s, transform 0.2s;
      }
      
      .react-flow__handle:hover {
        opacity: 1;
        transform: scale(1.2);
      }
      
      .react-flow__node {
        transition: transform 0.1s ease-out;
      }
      
      .react-flow__node-custom {
        width: auto;
        height: auto;
        border-radius: 5px;
        overflow: visible;
      }
      
      /* 添加加载按钮样式 */
      .load-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      
      .load-button .anticon {
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  return null;
};

// 扩展 Edge 类型，添加 label 属性
interface CustomEdgeData {
  label?: string;
  isEditing?: boolean;
  showDelete?: boolean;
}

// 自定义连线组件
const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
  markerEnd
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState((data as CustomEdgeData)?.label || '');
  const [showDelete, setShowDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const edgeRef = useRef<SVGPathElement>(null);
  const [edgeCenter, setEdgeCenter] = useState({ x: 0, y: 0 });
  const { setEdges } = useReactFlow();

  // 使用 getBezierPath 获得更平滑的曲线
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: sourcePosition || Position.Right,
    targetX,
    targetY,
    targetPosition: targetPosition || Position.Left,
    curvature: 0.25, // 使用固定的弯曲度
  });

  // 计算连线中心点，用于放置文字和按钮
  useEffect(() => {
    setEdgeCenter({ x: labelX, y: labelY });
  }, [labelX, labelY]);

  // 从 data 中获取状态
  useEffect(() => {
    if (data) {
      if ((data as CustomEdgeData).isEditing !== undefined) {
        setIsEditing((data as CustomEdgeData).isEditing || false);
      }
      if ((data as CustomEdgeData).showDelete !== undefined) {
        setShowDelete((data as CustomEdgeData).showDelete || false);
      }
      if ((data as CustomEdgeData).label !== undefined) {
        setLabel((data as CustomEdgeData).label || '');
      }
    }
  }, [data]);

  // 处理文本编辑完成
  const handleTextChange = () => {
    setIsEditing(false);
    const newLabel = inputRef.current?.value || '';
    setLabel(newLabel);
    
    setEdges((eds) => 
      eds.map((edge) => {
        if (edge.id === id) {
          return {
            ...edge,
            data: {
              ...edge.data,
              label: newLabel,
              isEditing: false
            }
          };
        }
        return edge;
      })
    );
  };

  // 处理删除连线
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <g>
      <path
        id={id}
        ref={edgeRef}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#1890ff' : '#b1b1b7',
          strokeWidth: selected ? 2 : 1.5,
          transition: 'all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          cursor: 'pointer',
        }}
        onDoubleClick={() => {
          setIsEditing(true);
          setShowDelete(true);
          
          // 更新全局状态
          setEdges((eds) => 
            eds.map((edge) => {
              if (edge.id === id) {
                return {
                  ...edge,
                  data: {
                    ...edge.data,
                    isEditing: true,
                    showDelete: true
                  },
                  selected: true
                };
              }
              return edge;
            })
          );
        }}
      />
      
      {/* 连线文字 */}
      {!isEditing && (
        <foreignObject
          width={80}
          height={30}
          x={edgeCenter.x - 40}
          y={edgeCenter.y - 15}
          className="edgebutton-foreignobject"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '100%',
              pointerEvents: 'all',
            }}
          >
            <div
              style={{
                padding: '2px 3px',
                fontSize: '9px',
                background: selected ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                borderRadius: '3px',
                color: selected ? '#1890ff' : '#666',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                transition: 'all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
              }}
            >
              {label}
            </div>
          </div>
        </foreignObject>
      )}
      
      {/* 编辑输入框 */}
      {isEditing && (
        <foreignObject
          width={90}
          height={30}
          x={edgeCenter.x - 45}
          y={edgeCenter.y - 15}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            style={{
              background: 'white',
              padding: '2px',
              borderRadius: '3px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <input
              ref={inputRef}
              defaultValue={label}
              autoFocus
              onBlur={handleTextChange}
              onKeyPress={(e) => e.key === 'Enter' && handleTextChange()}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '9px',
                padding: '1px 3px',
                textAlign: 'center',
              }}
            />
          </div>
        </foreignObject>
      )}
      
      {/* 删除按钮 - 仅在双击后显示 */}
      {selected && showDelete && !isEditing && (
        <foreignObject
          width={40}
          height={20}
          x={edgeCenter.x - 20}
          y={edgeCenter.y + 12}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <button
              onClick={handleDelete}
              style={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '3px',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                fontSize: '9px',
              }}
            >
              <DeleteOutlined style={{ fontSize: '9px', color: '#ff4d4f' }} />
            </button>
          </div>
        </foreignObject>
      )}
    </g>
  );
};

// 定义节点和连线类型 - 移到组件外部
const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

// 定义布局方向
const LAYOUT_DIRECTION = 'LR'; // LR = 从左到右, TB = 从上到下
const NODE_WIDTH = 112;
const NODE_HEIGHT = 56;

// 自动布局函数 - 添加eslint-disable注释，因为这个函数可能在将来会用到
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getLayoutedElements = (nodes: FlowNode[], edges: Edge[], direction = LAYOUT_DIRECTION) => {
  if (!nodes.length) return nodes;
  
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 设置布局方向和节点大小
  const isHorizontal = direction === 'LR' || direction === 'RL';
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: isHorizontal ? 100 : 50, // 节点之间的水平间距
    ranksep: isHorizontal ? 150 : 100, // 层级之间的垂直间距
    marginx: 50, // 图的水平边距
    marginy: 50, // 图的垂直边距
    align: 'DL', // 对齐方式：DL=向下和向左
    acyclicer: 'greedy', // 处理循环依赖
    ranker: 'network-simplex', // 布局算法
  });

  // 添加节点
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: NODE_WIDTH, 
      height: NODE_HEIGHT,
    });
  });

  // 添加边
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target, {
      weight: 1, // 边的权重
      minlen: 1, // 最小长度
    });
  });

  // 计算布局
  dagre.layout(dagreGraph);

  // 获取布局后的节点位置
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // 确保节点存在
    if (!nodeWithPosition) {
      return node;
    }
    
    // 根据连接方向调整节点位置
    const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
    let xOffset = 0;
    let yOffset = 0;
    
    // 根据连接的边调整位置，使连线更美观
    if (connectedEdges.length > 0) {
      const sourceEdges = edges.filter(e => e.source === node.id);
      const targetEdges = edges.filter(e => e.target === node.id);
      
      // 如果节点有多个子节点，稍微向下偏移以避免连线重叠
      if (sourceEdges.length > 2) {
        yOffset = 10;
      }
      
      // 如果节点是多个节点的目标，稍微向上偏移
      if (targetEdges.length > 2) {
        yOffset = -10;
      }
    }
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2 + xOffset,
        y: nodeWithPosition.y - NODE_HEIGHT / 2 + yOffset,
      },
      // 保存原始布局位置，用于动画
      data: {
        ...node.data,
        layoutX: nodeWithPosition.x - NODE_WIDTH / 2,
        layoutY: nodeWithPosition.y - NODE_HEIGHT / 2,
      }
    };
  });

  return layoutedNodes;
};

// 修改初始节点状态为空数组
const initialNodes: FlowNode[] = [];

const MindMap: React.FC = () => {
  // 基础状态
  const [nodes, setNodes, onNodesChangeDefault] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeDefault] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState(LAYOUT_DIRECTION);
  const [nodeSpacing, setNodeSpacing] = useState(100); // 节点间距
  const [rankSpacing, setRankSpacing] = useState(150); // 层级间距
  
  // 抽屉状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  
  const [saveDirectoryHandle, setSaveDirectoryHandle] = useState<any>(null);
  const [saveDirectoryPath, setSaveDirectoryPath] = useState<string>('未选择保存路径');
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    items?: { key: string; label: string; onClick: () => void }[];
  }>({
    visible: false,
    x: 0,
    y: 0,
  });
  
  // 功能状态
  const [isLocked, setIsLocked] = useState(false); // 锁定状态
  const [autoSave, setAutoSave] = useState<boolean>(true); // 自动保存状态
  const [canvasHistory, setCanvasHistory] = useState<{
    id: string;
    name: string;
    nodes: FlowNode[];
    edges: Edge[];
    createdAt: string;
  }[]>([]);
  const [currentCanvasId, setCurrentCanvasId] = useState<string>('default');
  const [currentCanvasName, setCurrentCanvasName] = useState<string>('未命名画布');
  const [isCanvasNameEditing, setIsCanvasNameEditing] = useState<boolean>(false);
  
  // 历史记录状态
  const [history, setHistory] = useState<{
    nodes: FlowNode[][];
    edges: Edge[][];
    currentIndex: number;
    lastActionTime: number;
  }>({
    nodes: [initialNodes],
    edges: [[]],
    currentIndex: 0,
    lastActionTime: Date.now(),
  });
  
  // 编辑器状态
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const [html, setHtml] = useState<string>('');
  
  // 引用和实例
  const [form] = Form.useForm();
  const reactFlowInstance = useReactFlow();
  const newNodeRef = useRef<FlowNode | null>(null);
  const connectingHandleRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const isUndoingRef = useRef(false);
  const lastHistoryUpdateRef = useRef<number>(Date.now());

  // 编辑器配置
  const editorConfig = useMemo<Partial<IEditorConfig>>(() => ({
    placeholder: '请输入内容...',
    MENU_CONF: {
      // 配置上传图片
      uploadImage: {
        // 自定义上传图片
        customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
          // 这里使用base64编码图片，实际项目中可以替换为真实的上传接口
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const url = reader.result as string;
            insertFn(url, file.name, url);
          };
        }
      },
      // 配置代码高亮
      codeSelectLang: {
        codeLangs: [
          { text: 'JavaScript', value: 'javascript' },
          { text: 'TypeScript', value: 'typescript' },
          { text: 'HTML', value: 'html' },
          { text: 'CSS', value: 'css' },
          { text: 'Java', value: 'java' },
          { text: 'Python', value: 'python' },
          { text: 'Go', value: 'go' },
          { text: 'SQL', value: 'sql' },
          { text: 'Bash', value: 'bash' },
          { text: 'JSON', value: 'json' },
        ]
      }
    },
  }), []);
  
  // 工具栏配置
  const toolbarConfig = useMemo<Partial<IToolbarConfig>>(() => ({
    excludeKeys: [],
  }), []);

  // 添加历史记录
  const addToHistory = useCallback((newNodes: FlowNode[], newEdges: Edge[]) => {
    if (isUndoingRef.current) return;
    
    // 防止频繁更新历史记录，至少间隔100ms
    const now = Date.now();
    if (now - lastHistoryUpdateRef.current < 100) return;
    lastHistoryUpdateRef.current = now;
    
    setHistory(prev => {
      // 如果当前不是最新状态，则删除当前索引之后的所有历史
      const newNodesHistory = prev.nodes.slice(0, prev.currentIndex + 1);
      const newEdgesHistory = prev.edges.slice(0, prev.currentIndex + 1);
      
      // 检查是否与最后一个状态相同，如果相同则不添加
      const lastNodes = newNodesHistory[newNodesHistory.length - 1];
      const lastEdges = newEdgesHistory[newEdgesHistory.length - 1];
      
      // 简单比较节点和边的数量
      if (
        lastNodes.length === newNodes.length && 
        lastEdges.length === newEdges.length &&
        now - prev.lastActionTime < 500 // 如果操作间隔小于500ms，可能是连续操作
      ) {
        // 如果数量相同，可能是相同状态，不添加新历史
        return prev;
      }
      
      // 添加新状态
      const nodesClone = JSON.parse(JSON.stringify(newNodes));
      const edgesClone = JSON.parse(JSON.stringify(newEdges));
      newNodesHistory.push(nodesClone);
      newEdgesHistory.push(edgesClone);
      
      // 限制历史记录长度，最多保存50步
      const maxHistoryLength = 50;
      if (newNodesHistory.length > maxHistoryLength) {
        newNodesHistory.shift();
        newEdgesHistory.shift();
      }
      
      return {
        nodes: newNodesHistory,
        edges: newEdgesHistory,
        currentIndex: newNodesHistory.length - 1,
        lastActionTime: now,
      };
    });
  }, []);

  // 撤销操作
  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.currentIndex <= 0) return prev;
      
      const newIndex = prev.currentIndex - 1;
      const prevNodes = prev.nodes[newIndex];
      const prevEdges = prev.edges[newIndex];
      
      // 设置标志，防止撤销操作被记录为新的历史
      isUndoingRef.current = true;
      
      // 立即更新节点和边
      setNodes([...prevNodes]);
      setEdges([...prevEdges]);
      
      // 短暂延迟后重置标志
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 50);
      
      return {
        ...prev,
        currentIndex: newIndex,
        lastActionTime: Date.now(),
      };
    });
  }, [setNodes, setEdges]);

  // 重做操作
  const handleRedo = useCallback(() => {
    setHistory(prev => {
      if (prev.currentIndex >= prev.nodes.length - 1) return prev;
      
      const newIndex = prev.currentIndex + 1;
      const nextNodes = prev.nodes[newIndex];
      const nextEdges = prev.edges[newIndex];
      
      // 设置标志，防止重做操作被记录为新的历史
      isUndoingRef.current = true;
      
      // 立即更新节点和边
      setNodes([...nextNodes]);
      setEdges([...nextEdges]);
      
      // 短暂延迟后重置标志
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 50);
      
      return {
        ...prev,
        currentIndex: newIndex,
        lastActionTime: Date.now(),
      };
    });
  }, [setNodes, setEdges]);

  // 监听节点变化，添加到历史记录
  useEffect(() => {
    // 如果是撤销/重做操作，不添加历史记录
    if (isUndoingRef.current) return;
    
    // 使用防抖，避免频繁更新历史记录
    const timeoutId = setTimeout(() => {
      addToHistory(nodes, edges);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, addToHistory]);

  // 自定义节点变化处理函数，优化拖动性能
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // 检查是否有节点正在被拖动
    const dragChange = changes.find(
      (change): change is NodePositionChange => 
        change.type === 'position' && 'dragging' in change
    );
    
    if (dragChange && dragChange.dragging) {
      isDraggingRef.current = true;
    } else if (isDraggingRef.current) {
      // 拖动结束
      isDraggingRef.current = false;
    }
    
    // 使用默认的节点变化处理函数
    onNodesChangeDefault(changes);
  }, [onNodesChangeDefault]);
  
  // 自定义边变化处理函数，优化连线更新
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    // 使用默认的边变化处理函数
    onEdgesChangeDefault(changes);
  }, [onEdgesChangeDefault]);

  // 处理自动布局
  const handleAutoLayout = useCallback(() => {
    if (!nodes.length) return;
    
    // 保存当前节点位置，用于动画
    const nodesWithOriginalPositions = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        originalX: node.position.x,
        originalY: node.position.y,
      }
    }));
    
    // 创建一个新的 dagre 图
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // 设置布局方向和节点大小
    const isHorizontal = layoutDirection === 'LR' || layoutDirection === 'RL';
    dagreGraph.setGraph({ 
      rankdir: layoutDirection,
      nodesep: isHorizontal ? nodeSpacing * 1.2 : nodeSpacing * 0.6, // 增加节点之间的水平间距
      ranksep: isHorizontal ? rankSpacing * 1.0 : rankSpacing * 0.7, // 增加层级之间的垂直间距
      marginx: 50, // 增加图的水平边距
      marginy: 50, // 增加图的垂直边距
      align: 'DL', // 对齐方式：DL=向下和向左
      acyclicer: 'greedy', // 处理循环依赖
      ranker: 'network-simplex', // 布局算法
    });

    // 添加节点
    nodesWithOriginalPositions.forEach((node) => {
      dagreGraph.setNode(node.id, { 
        width: NODE_WIDTH + 20, // 增加节点宽度以防止重叠
        height: NODE_HEIGHT + 10, // 增加节点高度以防止重叠
      });
    });

    // 添加边
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target, {
        weight: 1, // 边的权重
        minlen: 1.2, // 增加最小长度，使节点之间有更多空间
      });
    });

    // 计算布局
    dagre.layout(dagreGraph);

    // 获取布局后的节点位置
    const layoutedNodes = nodesWithOriginalPositions.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      
      // 确保节点存在
      if (!nodeWithPosition) {
        return node;
      }
      
      // 根据连接方向调整节点位置
      const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
      let xOffset = 0;
      let yOffset = 0;
      
      // 根据连接的边调整位置，使连线更美观
      if (connectedEdges.length > 0) {
        const sourceEdges = edges.filter(e => e.source === node.id);
        const targetEdges = edges.filter(e => e.target === node.id);
        
        // 如果节点有多个子节点，增加偏移以避免连线重叠
        if (sourceEdges.length > 2) {
          yOffset = isHorizontal ? 15 : 0;
          xOffset = isHorizontal ? 0 : 15;
        }
        
        // 如果节点是多个节点的目标，增加偏移
        if (targetEdges.length > 2) {
          yOffset = isHorizontal ? -15 : 0;
          xOffset = isHorizontal ? 0 : -15;
        }
        
        // 如果同时有多个源和目标，调整偏移量
        if (sourceEdges.length > 1 && targetEdges.length > 1) {
          if (isHorizontal) {
            yOffset = sourceEdges.length > targetEdges.length ? 20 : -20;
          } else {
            xOffset = sourceEdges.length > targetEdges.length ? 20 : -20;
          }
        }
      }
      
      // 计算新位置
      const newX = nodeWithPosition.x - NODE_WIDTH / 2 + xOffset;
      const newY = nodeWithPosition.y - NODE_HEIGHT / 2 + yOffset;
      
      return {
        ...node,
        position: {
          x: newX,
          y: newY,
        },
        style: {
          ...node.style,
          transition: 'transform 0.5s ease-out',
        }
      };
    });
    
    // 检测并解决节点重叠问题
    const resolveOverlaps = (nodes: FlowNode[]) => {
      const nodePositions = new Map<string, {x: number, y: number, width: number, height: number}>();
      
      // 记录所有节点的位置和大小
      nodes.forEach(node => {
        nodePositions.set(node.id, {
          x: node.position.x,
          y: node.position.y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT
        });
      });
      
      // 检测重叠并调整位置
      const adjustedNodes = [...nodes];
      let hasOverlap = true;
      let iterations = 0;
      const maxIterations = 3; // 限制迭代次数
      
      while (hasOverlap && iterations < maxIterations) {
        hasOverlap = false;
        iterations++;
        
        for (let i = 0; i < adjustedNodes.length; i++) {
          const nodeA = adjustedNodes[i];
          const posA = nodePositions.get(nodeA.id)!;
          
          for (let j = i + 1; j < adjustedNodes.length; j++) {
            const nodeB = adjustedNodes[j];
            const posB = nodePositions.get(nodeB.id)!;
            
            // 检测两个节点是否重叠
            const overlapX = Math.abs(posA.x - posB.x) < (posA.width + posB.width) / 2 - 5;
            const overlapY = Math.abs(posA.y - posB.y) < (posA.height + posB.height) / 2 - 5;
            
            if (overlapX && overlapY) {
              hasOverlap = true;
              
              // 计算需要移动的距离
              const moveX = ((posA.width + posB.width) / 2 + 10) - Math.abs(posA.x - posB.x);
              const moveY = ((posA.height + posB.height) / 2 + 10) - Math.abs(posA.y - posB.y);
              
              // 选择移动距离较小的方向
              if (moveX < moveY) {
                // 水平方向移动
                const direction = posA.x < posB.x ? -1 : 1;
                adjustedNodes[i] = {
                  ...nodeA,
                  position: {
                    ...nodeA.position,
                    x: nodeA.position.x + direction * moveX / 2
                  }
                };
                adjustedNodes[j] = {
                  ...nodeB,
                  position: {
                    ...nodeB.position,
                    x: nodeB.position.x - direction * moveX / 2
                  }
                };
                
                // 更新位置记录
                nodePositions.set(nodeA.id, {
                  ...posA,
                  x: posA.x + direction * moveX / 2
                });
                nodePositions.set(nodeB.id, {
                  ...posB,
                  x: posB.x - direction * moveX / 2
                });
              } else {
                // 垂直方向移动
                const direction = posA.y < posB.y ? -1 : 1;
                adjustedNodes[i] = {
                  ...nodeA,
                  position: {
                    ...nodeA.position,
                    y: nodeA.position.y + direction * moveY / 2
                  }
                };
                adjustedNodes[j] = {
                  ...nodeB,
                  position: {
                    ...nodeB.position,
                    y: nodeB.position.y - direction * moveY / 2
                  }
                };
                
                // 更新位置记录
                nodePositions.set(nodeA.id, {
                  ...posA,
                  y: posA.y + direction * moveY / 2
                });
                nodePositions.set(nodeB.id, {
                  ...posB,
                  y: posB.y - direction * moveY / 2
                });
              }
            }
          }
        }
      }
      
      return adjustedNodes;
    };
    
    // 应用重叠解决算法
    const finalNodes = resolveOverlaps(layoutedNodes);
    
    setNodes(finalNodes);
    
    // 使用 fitView 确保所有节点都在视图中
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.3, duration: 800 });
    }, 50);
  }, [nodes, edges, setNodes, reactFlowInstance, layoutDirection, nodeSpacing, rankSpacing]);

  // 获取当前思维导图数据
  const getMindMapData = (): MindMapData => {
    // 构建思维导图数据结构
    const mindMapData: MindMapData = {
      mindMaps: []
    };
    
    // 创建节点映射，用于构建树形结构
    const nodeMap = new Map<string, MindMapNode>();
    
    // 首先创建所有节点
    nodes.forEach(node => {
      if (node.data.nodeData) {
        nodeMap.set(node.id, {
          ...node.data.nodeData,
          children: []
        });
      }
    });
    
    // 记录已经有父节点的节点ID
    const childNodeIds = new Set<string>();
    
    // 根据边构建父子关系
    edges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      
      if (sourceNode && targetNode) {
        // 如果边有标签，将其添加到目标节点
        if (edge.data?.label) {
          targetNode.edgeLabel = edge.data.label;
        }
        
        // 将目标节点添加为源节点的子节点
        if (sourceNode.children) {
          sourceNode.children.push(targetNode);
          childNodeIds.add(edge.target);
        }
      }
    });
    
    // 找出所有根节点（没有父节点的节点）
    const rootNodes: MindMapNode[] = [];
    nodeMap.forEach((node, id) => {
      if (!childNodeIds.has(id)) {
        rootNodes.push(node);
      }
    });
    
    // 创建主题
    const theme: MindMapTheme = {
      id: 'theme-' + Date.now(),
      title: '思维导图',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: rootNodes
    };
    
    mindMapData.mindMaps.push(theme);
    return mindMapData;
  };

  // 处理保存
  const handleSave = async () => {
    try {
      // 创建节点映射
      const nodeMap = new Map();
      const rootNodes: MindMapNode[] = [];
      
      // 创建主题
      const currentTheme: MindMapTheme = {
        id: currentCanvasId,
        title: currentCanvasName,
        created_at: new Date().toISOString(),
        children: [],
      };
      
      // 首先创建所有节点
      nodes.forEach(node => {
        const { nodeData } = node.data;
        nodeMap.set(node.id, {
          id: node.id,
          title: nodeData.title || '',
          description: nodeData.description || '',
          priority: nodeData.priority,
          status: nodeData.status,
          created_at: nodeData.created_at || new Date().toISOString(),
          start_date: nodeData.start_date,
          due_date: nodeData.due_date,
          children: [],
        });
      });
      
      // 然后建立父子关系
      edges.forEach(edge => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        
        if (sourceNode && targetNode) {
          if (!sourceNode.children) {
            sourceNode.children = [];
          }
          sourceNode.children.push(targetNode);
          
          // 如果边有标签，添加到目标节点
          if (edge.data && edge.data.label) {
            targetNode.edgeLabel = edge.data.label ? String(edge.data.label) : undefined;
          }
        }
      });
      
      // 找出根节点（没有入边的节点）
      const targetIds = new Set(edges.map(edge => edge.target));
      nodes.forEach(node => {
        if (!targetIds.has(node.id)) {
          const rootNode = nodeMap.get(node.id);
          if (rootNode) {
            rootNodes.push(rootNode);
          }
        }
      });
      
      // 设置根节点
      currentTheme.children = rootNodes;
      
      // 创建完整的MindMapData
      const mindMapData: MindMapData = {
        mindMaps: [currentTheme],
      };
      
      // 检查是否在非 HTTPS 环境
      const isNotSecure = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost';
      
      // 如果没有选择保存目录且环境支持，提示用户选择
      if (!saveDirectoryHandle && 'showDirectoryPicker' in window && !isNotSecure) {
        const shouldSelect = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '选择保存路径',
            content: '您尚未选择保存路径，是否现在选择？',
            okText: '选择',
            cancelText: '取消',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        
        if (shouldSelect) {
          await selectSaveDirectory();
        }
      }
      
      // 保存到JSON文件，使用画布名称作为文件名
      const jsonSuccess = await saveToFile(mindMapData, currentCanvasName, saveDirectoryHandle);
      
      // 保存到Markdown文件，使用画布名称作为文件名
      const mdSuccess = await saveToMarkdown(mindMapData, currentCanvasName, saveDirectoryHandle);
      
      if (jsonSuccess && mdSuccess) {
        if (saveDirectoryHandle) {
          message.success(`思维导图已保存到 ${saveDirectoryPath} 目录`);
        } else if (isNotSecure) {
          message.success('思维导图已保存为JSON和Markdown格式（使用传统下载方式）');
        } else {
          message.success('思维导图已保存为JSON和Markdown格式');
        }
      } else if (jsonSuccess) {
        if (saveDirectoryHandle) {
          message.success(`JSON文件已保存到 ${saveDirectoryPath} 目录，但Markdown格式保存失败`);
        } else if (isNotSecure) {
          message.success('思维导图已保存为JSON格式（使用传统下载方式），但Markdown格式保存失败');
        } else {
          message.success('思维导图已保存为JSON格式，但Markdown格式保存失败');
        }
      } else if (mdSuccess) {
        if (saveDirectoryHandle) {
          message.success(`Markdown文件已保存到 ${saveDirectoryPath} 目录，但JSON格式保存失败`);
        } else if (isNotSecure) {
          message.success('思维导图已保存为Markdown格式（使用传统下载方式），但JSON格式保存失败');
        } else {
          message.success('思维导图已保存为Markdown格式，但JSON格式保存失败');
        }
      } else {
        message.error('保存失败');
      }
    } catch (error) {
      console.error('保存思维导图时出错:', error);
      message.error('保存失败');
    }
  };

  // 添加连接成功的标志变量
  const connectionSuccessfulRef = useRef(false);

  // 处理连接事件
  const onConnect = useCallback((params: Connection) => {
    console.log('连接参数:', params); // 调试信息
    
    // 设置连接成功标志
    connectionSuccessfulRef.current = true;
    
    // 检查是否已存在完全相同的连接（相同的源节点和目标节点以及相同的连接点）
    const existingEdge = edges.find(
      edge => edge.source === params.source && 
             edge.target === params.target && 
             edge.sourceHandle === params.sourceHandle && 
             edge.targetHandle === params.targetHandle
    );
    
    if (!existingEdge && params.source && params.target) {
      // 获取源节点和目标节点
      const sourceNode = nodes.find(node => node.id === params.source);
      const targetNode = nodes.find(node => node.id === params.target);
      
      if (sourceNode && targetNode) {
        // 智能选择连接点
        // 如果用户没有明确指定连接点，根据节点之间的相对位置自动选择最合适的连接点
        let sourceHandle = params.sourceHandle;
        let targetHandle = params.targetHandle;
        
        if (!sourceHandle || !targetHandle) {
          // 计算节点之间的相对位置
          const dx = targetNode.position.x - sourceNode.position.x;
          const dy = targetNode.position.y - sourceNode.position.y;
          
          // 计算源节点到目标节点的距离
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // 计算各个方向的单位向量
          const directions = {
            right: { x: 1, y: 0 },
            left: { x: -1, y: 0 },
            bottom: { x: 0, y: 1 },
            top: { x: 0, y: -1 }
          };
          
          // 计算源节点到目标节点的单位向量
          const unitVector = {
            x: dx / distance,
            y: dy / distance
          };
          
          // 找出最接近的源节点连接点方向
          let bestSourceDirection = 'right';
          let bestSourceDotProduct = -Infinity;
          
          for (const [direction, vector] of Object.entries(directions)) {
            const dotProduct = unitVector.x * vector.x + unitVector.y * vector.y;
            if (dotProduct > bestSourceDotProduct) {
              bestSourceDotProduct = dotProduct;
              bestSourceDirection = direction;
            }
          }
          
          // 找出最接近的目标节点连接点方向（与源节点方向相反）
          let bestTargetDirection = 'left';
          let bestTargetDotProduct = -Infinity;
          
          for (const [direction, vector] of Object.entries(directions)) {
            // 计算与源节点方向相反的向量的点积
            const dotProduct = -unitVector.x * vector.x + -unitVector.y * vector.y;
            if (dotProduct > bestTargetDotProduct) {
              bestTargetDotProduct = dotProduct;
              bestTargetDirection = direction;
            }
          }
          
          // 设置连接点
          sourceHandle = bestSourceDirection;
          targetHandle = bestTargetDirection;
          
          console.log(`自动选择连接点: 源=${bestSourceDirection}, 目标=${bestTargetDirection}`);
        }
        
        // 创建新连线
        const newEdge: Edge = {
          ...params,
          id: `edge-${Date.now()}`,
          source: params.source,
          target: params.target,
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          type: 'custom',
          data: { label: '' }, // 添加空标签
        };
        
        console.log('创建新连线:', newEdge); // 调试信息
        setEdges((eds) => addEdge(newEdge, eds));
      }
    } else {
      console.log('连接已存在或参数无效，不创建新连线');
    }
  }, [edges, nodes, setEdges]);

  // 处理连接开始事件
  const onConnectStart: OnConnectStart = useCallback(
    (event, { nodeId, handleId }) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        // 保存连接的起始方向
        connectingHandleRef.current = handleId || null;
        // 重置连接成功标志
        connectionSuccessfulRef.current = false;
        console.log('连接开始，方向:', handleId); // 调试信息
      }
    },
    [nodes]
  );

  // 处理连接结束事件
  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!event || !('clientX' in event) || !('clientY' in event)) return;
      
      // 检查连接是否成功
      if (connectionSuccessfulRef.current) {
        console.log('连接成功，不创建新节点');
        // 清空连接起始方向
        connectingHandleRef.current = null;
        // 重置连接成功标志
        connectionSuccessfulRef.current = false;
        return;
      }
      
      // 检查目标是否为画布（空白区域）
      const targetIsPane = (event.target as Element)?.classList?.contains('react-flow__pane');
      
      // 只有在拖动到空白区域且连接失败时才创建新节点
      if (targetIsPane && selectedNode) {
        console.log('连接失败，创建新节点');
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // 使用保存的连接起始方向
        const sourceHandleId = connectingHandleRef.current;
        console.log('连接结束，起始连接点:', sourceHandleId); // 调试信息
        
        if (!sourceHandleId) {
          console.log('没有有效的连接点，不创建新节点');
          // 重置连接成功标志
          connectionSuccessfulRef.current = false;
          connectingHandleRef.current = null;
          return; // 如果没有有效的连接点，不创建新节点
        }
        
        // 计算新节点与当前节点的距离
        // 水平和垂直方向使用不同的距离，使布局更加美观
        const HORIZONTAL_OFFSET = NODE_WIDTH * 1.5; // 水平方向距离为节点宽度的1.5倍
        const VERTICAL_OFFSET = NODE_HEIGHT * 2; // 垂直方向距离为节点高度的2倍
        
        let adjustedPosition = { ...position };
        let targetHandleId: string;

        // 根据连接的起始方向设置新节点的位置和连接点
        if (sourceHandleId === 'top') {
          adjustedPosition = {
            x: selectedNode.position.x,
            y: selectedNode.position.y - VERTICAL_OFFSET,
          };
          targetHandleId = 'bottom';
        } else if (sourceHandleId === 'right') {
          adjustedPosition = {
            x: selectedNode.position.x + HORIZONTAL_OFFSET,
            y: selectedNode.position.y,
          };
          targetHandleId = 'left';
        } else if (sourceHandleId === 'bottom') {
          adjustedPosition = {
            x: selectedNode.position.x,
            y: selectedNode.position.y + VERTICAL_OFFSET,
          };
          targetHandleId = 'top';
        } else if (sourceHandleId === 'left') {
          adjustedPosition = {
            x: selectedNode.position.x - HORIZONTAL_OFFSET,
            y: selectedNode.position.y,
          };
          targetHandleId = 'right';
        } else {
          console.log('未知的连接点:', sourceHandleId);
          // 重置连接标志
          connectionSuccessfulRef.current = false;
          connectingHandleRef.current = null;
          return; // 如果没有有效的连接点，不创建新节点
        }
        
        console.log('创建新节点，位置:', adjustedPosition, '目标连接点:', targetHandleId);
        
        const currentDate = new Date().toISOString().split('T')[0];
        const newNodeId = `node-${Date.now()}`;
        
        // 创建新节点
        const newNode: FlowNode = {
          id: newNodeId,
          type: 'custom',
          position: adjustedPosition,
          data: {
            label: '新任务',
            nodeData: {
              id: newNodeId,
              title: '新任务',
              created_at: new Date().toISOString(),
              start_date: currentDate,
              due_date: currentDate,
            }
          },
        };
        
        // 创建新连线，包含正确的连接点位置
        const newEdge: Edge = {
          id: `edge-${Date.now()}`,
          source: selectedNode.id,
          target: newNodeId,
          type: 'custom',
          sourceHandle: sourceHandleId,
          targetHandle: targetHandleId,
          animated: false,
          data: { label: '' }, // 添加空标签
        };
        
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, newEdge]);
        
        newNodeRef.current = newNode;
        setSelectedNode(newNode);
        
        // 重置连接标志
        connectionSuccessfulRef.current = false;
        connectingHandleRef.current = null;
        
        // 不再弹出编辑界面，保持与新增节点行为一致
      } else {
        // 如果不是拖到空白区域或没有选中节点，也要重置标志
        connectionSuccessfulRef.current = false;
        connectingHandleRef.current = null;
      }
    },
    [selectedNode, reactFlowInstance, setNodes, setEdges]
  );

  // 处理节点点击事件
  const handleNodeClick: NodeMouseHandler = (event, node) => {
    event.stopPropagation();
    setSelectedNode(node);
    
    // 确保 form 实例已经准备好
    if (form && node.data.nodeData) {
      // 使用 setTimeout 确保在下一个事件循环中执行
      setTimeout(() => {
        form.setFieldsValue({
          title: node.data.nodeData.title || '',
          priority: node.data.nodeData.priority || undefined,
          status: node.data.nodeData.status || undefined,
          start_date: node.data.nodeData.start_date || '',
          due_date: node.data.nodeData.due_date || '',
        });
      }, 0);
      
      // 更新富文本编辑器内容
      setHtml(node.data.nodeData.description || '');
    }
  };

  // 双击节点打开编辑弹窗
  const handleNodeDoubleClick: NodeMouseHandler = (event: React.MouseEvent, node: FlowNode) => {
    setSelectedNode(node);
    if (node.data.nodeData) {
      const currentDate = new Date().toISOString().split('T')[0];
      form.setFieldsValue({
        title: node.data.nodeData.title,
        priority: node.data.nodeData.priority,
        status: node.data.nodeData.status,
        start_date: node.data.nodeData.start_date || currentDate,
        due_date: node.data.nodeData.due_date || currentDate,
      });
      setHtml(node.data.nodeData.description || '');
      setIsModalVisible(true);
    }
  };

  const handleContextMenu = (event: React.MouseEvent, node: FlowNode) => {
    event.preventDefault();
    setSelectedNode(node);
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      items: [
        {
          key: 'add-node',
          label: '添加子节点',
          onClick: () => handleAddNode(node.id),
        }
      ],
    });
  };

  const handlePaneContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setSelectedNode(null);
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      items: [
        {
          key: 'add-node',
          label: '新增节点',
          onClick: () => handleAddNode(),
        }
      ],
    });
  };

  const handleClick = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
    });
  };

  const handleAddNode = (parentId?: string) => {
    const currentDate = new Date().toISOString().split('T')[0];
    const newNodeId = `node-${Date.now()}`;
    
    // 获取当前视图的可见区域
    const { x, y, zoom } = reactFlowInstance.getViewport();
    
    // 计算视图中心点的坐标
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // 将屏幕坐标转换为流程图坐标
    const flowPosition = reactFlowInstance.screenToFlowPosition({
      x: centerX,
      y: centerY,
    });
    
    // 默认位置：视图中心点
    let newNodePosition = { 
      x: flowPosition.x, 
      y: flowPosition.y 
    };
    
    // 如果有父节点，则相对于父节点定位
    if (parentId) {
      const parentNode = nodes.find(node => node.id === parentId);
      if (parentNode) {
        const HORIZONTAL_OFFSET = NODE_WIDTH * 1.5;
        
        // 初始位置：父节点右侧
        newNodePosition = {
          x: parentNode.position.x + HORIZONTAL_OFFSET,
          y: parentNode.position.y,
        };
        
        // 检查是否与现有节点重叠
        const isOverlapping = (pos: {x: number, y: number}) => {
          return nodes.some(node => {
            if (node.id === parentId) return false; // 忽略父节点
            const dx = Math.abs(node.position.x - pos.x);
            const dy = Math.abs(node.position.y - pos.y);
            // 增加判断边距，确保节点之间有足够空间
            return dx < NODE_WIDTH * 1.2 && dy < NODE_HEIGHT * 1.2;
          });
        };
        
        // 如果重叠，尝试找到一个不重叠的位置
        if (isOverlapping(newNodePosition)) {
          // 尝试更多方向的位置偏移
          const offsets = [
            { x: 0, y: NODE_HEIGHT * 1.5 },  // 下方
            { x: 0, y: -NODE_HEIGHT * 1.5 }, // 上方
            { x: NODE_WIDTH * 1.5, y: 0 },   // 更远的右侧
            { x: NODE_WIDTH * 1.0, y: NODE_HEIGHT * 1.0 },  // 右下
            { x: NODE_WIDTH * 1.0, y: -NODE_HEIGHT * 1.0 }, // 右上
            { x: NODE_WIDTH * 2.0, y: NODE_HEIGHT * 0.5 },  // 更远的右下
            { x: NODE_WIDTH * 2.0, y: -NODE_HEIGHT * 0.5 }, // 更远的右上
            { x: NODE_WIDTH * 2.5, y: 0 },   // 最远的右侧
          ];
          
          // 尝试每个偏移位置，直到找到不重叠的位置
          let foundNonOverlappingPosition = false;
          for (const offset of offsets) {
            const testPosition = {
              x: parentNode.position.x + HORIZONTAL_OFFSET + offset.x,
              y: parentNode.position.y + offset.y
            };
            
            if (!isOverlapping(testPosition)) {
              newNodePosition = testPosition;
              foundNonOverlappingPosition = true;
              break;
            }
          }
          
          // 如果所有预定义位置都重叠，则使用随机偏移
          if (!foundNonOverlappingPosition) {
            // 生成随机偏移，直到找到不重叠的位置
            let attempts = 0;
            const maxAttempts = 20; // 最大尝试次数
            
            while (isOverlapping(newNodePosition) && attempts < maxAttempts) {
              const randomOffsetX = (Math.random() * 2 - 1) * NODE_WIDTH * 3; // -3*WIDTH 到 3*WIDTH
              const randomOffsetY = (Math.random() * 2 - 1) * NODE_HEIGHT * 3; // -3*HEIGHT 到 3*HEIGHT
              
              newNodePosition = {
                x: parentNode.position.x + HORIZONTAL_OFFSET + randomOffsetX,
                y: parentNode.position.y + randomOffsetY
              };
              
              attempts++;
            }
          }
        }
        
        const newEdge: Edge = {
          id: `edge-${Date.now()}`,
          source: parentId,
          target: newNodeId,
          type: 'custom',
          sourceHandle: 'right',
          targetHandle: 'left',
          animated: false,
          data: { label: '' },
        };
        
        setEdges((eds) => [...eds, newEdge]);
      }
    } else {
      // 如果没有父节点，则在视图中心创建节点，但避免与现有节点重叠
      const isOverlapping = (pos: {x: number, y: number}) => {
        return nodes.some(node => {
          const dx = Math.abs(node.position.x - pos.x);
          const dy = Math.abs(node.position.y - pos.y);
          return dx < NODE_WIDTH * 1.2 && dy < NODE_HEIGHT * 1.2;
        });
      };
      
      // 如果中心点位置重叠，尝试找到一个不重叠的位置
      if (nodes.length > 0 && isOverlapping(newNodePosition)) {
        // 在视图中心周围尝试不同的位置
        const viewCenterOffsets = [
          { x: NODE_WIDTH * 1.5, y: 0 },
          { x: -NODE_WIDTH * 1.5, y: 0 },
          { x: 0, y: NODE_HEIGHT * 1.5 },
          { x: 0, y: -NODE_HEIGHT * 1.5 },
          { x: NODE_WIDTH, y: NODE_HEIGHT },
          { x: -NODE_WIDTH, y: NODE_HEIGHT },
          { x: NODE_WIDTH, y: -NODE_HEIGHT },
          { x: -NODE_WIDTH, y: -NODE_HEIGHT },
        ];
        
        let foundNonOverlappingPosition = false;
        for (const offset of viewCenterOffsets) {
          const testPosition = {
            x: flowPosition.x + offset.x,
            y: flowPosition.y + offset.y
          };
          
          if (!isOverlapping(testPosition)) {
            newNodePosition = testPosition;
            foundNonOverlappingPosition = true;
            break;
          }
        }
        
        // 如果所有预定义位置都重叠，则使用随机偏移
        if (!foundNonOverlappingPosition) {
          let attempts = 0;
          const maxAttempts = 20;
          
          while (isOverlapping(newNodePosition) && attempts < maxAttempts) {
            const randomOffsetX = (Math.random() * 2 - 1) * NODE_WIDTH * 3;
            const randomOffsetY = (Math.random() * 2 - 1) * NODE_HEIGHT * 3;
            
            newNodePosition = {
              x: flowPosition.x + randomOffsetX,
              y: flowPosition.y + randomOffsetY
            };
            
            attempts++;
          }
        }
      }
    }
    
    const newNode: FlowNode = {
      id: newNodeId,
      type: 'custom',
      data: { 
        label: '新任务',
        nodeData: {
          id: newNodeId,
          title: '新任务',
          created_at: new Date().toISOString(),
          start_date: currentDate,
          due_date: currentDate,
        },
        isLocked, // 添加锁定状态
      },
      position: newNodePosition,
    };
    
    // 添加新节点
    setNodes((nds) => {
      const updatedNodes = [...nds, newNode];
      return updatedNodes;
    });
    
    // 确保新节点在视图中可见
    setTimeout(() => {
      // 使用setCenter方法聚焦到新节点
      reactFlowInstance.setCenter(
        newNodePosition.x + NODE_WIDTH / 2,
        newNodePosition.y + NODE_HEIGHT / 2,
        { duration: 500 }
      );
    }, 50);
    
    setSelectedNode(newNode);
    
    if (parentId) {
      form.resetFields();
      setIsModalVisible(true);
    }
    
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  const handleAddTheme = () => {
    // 添加新主题节点，位置在画布中心
    const currentDate = new Date().toISOString().split('T')[0];
    const newNodeId = `node-${Date.now()}`;
    
    // 获取当前视图的中心位置
    const centerX = window.innerWidth / 2 - 100;
    const centerY = window.innerHeight / 2 - 100;
    
    const newNode: FlowNode = {
      id: newNodeId,
      type: 'custom',
      data: { 
        label: '新主题',
        nodeData: {
          id: newNodeId,
          title: '新主题',
          created_at: new Date().toISOString(),
          start_date: currentDate,
          due_date: currentDate,
        }
      },
      position: { x: centerX, y: centerY },
    };
    
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    // 不弹出编辑界面，保持与新增节点行为一致
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (selectedNode) {
        const updatedNodes = nodes.map((node) => {
          if (node.id === selectedNode.id) {
            const nodeData = {
              ...node.data.nodeData,
              ...values,
              description: html, // 使用富文本编辑器的HTML内容
              updated_at: new Date().toISOString(),
            };
            return {
              ...node,
              data: {
                ...node.data,
                label: values.title,
                nodeData,
              },
            };
          }
          return node;
        });
        setNodes(updatedNodes);
      }
      setIsModalVisible(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleModalCancel = async () => {
    // 如果是新创建的节点被取消，则删除该节点
    if (newNodeRef.current) {
      setNodes((nds) => nds.filter(node => node.id !== newNodeRef.current?.id));
      // 同时删除与该节点相关的边
      setEdges((eds) => eds.filter(edge => 
        edge.source !== newNodeRef.current?.id && edge.target !== newNodeRef.current?.id
      ));
      newNodeRef.current = null;
    } else if (selectedNode && autoSave) { // 只有在启用自动保存时才保存
      // 如果是编辑现有节点，自动保存修改内容
      try {
        // 获取表单当前值，不进行验证
        const values = form.getFieldsValue();
        
        // 更新节点数据
        const updatedNodes = nodes.map((node) => {
          if (node.id === selectedNode.id) {
            const nodeData = {
              ...node.data.nodeData,
              ...values,
              description: html, // 使用富文本编辑器的HTML内容
              updated_at: new Date().toISOString(),
            };
            return {
              ...node,
              data: {
                ...node.data,
                label: values.title || node.data.label,
                nodeData,
              },
            };
          }
          return node;
        });
        setNodes(updatedNodes);
        
        // 显示自动保存成功提示
        message.success({
          content: '内容已自动保存',
          duration: 2,
          style: {
            marginTop: '20px',
          },
        });
      } catch (error) {
        console.error('自动保存失败:', error);
        
        // 显示自动保存失败提示
        message.error({
          content: '自动保存失败',
          duration: 2,
          style: {
            marginTop: '20px',
          },
        });
      }
    }
    
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleLoad = async () => {
    try {
      const data = await loadFromFile();
      if (data?.mindMaps && data.mindMaps.length > 0) {
        // 清空当前画布
        setNodes([]);
        setEdges([]);
        
        // 创建新节点和边
        const newNodes: FlowNode[] = [];
        const newEdges: Edge[] = [];
        const currentDate = new Date().toISOString().split('T')[0];
        
        // 递归处理节点及其子节点
        const processNode = (node: MindMapNode, parentId?: string, position = { x: 0, y: 0 }, level = 0) => {
          // 创建节点
          const newNode: FlowNode = {
            id: node.id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // 确保ID唯一
            type: 'custom',
            position: position,
            data: {
              label: node.title,
              nodeData: {
                id: node.id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: node.title || '',
                description: node.description || '',
                priority: node.priority,
                status: node.status,
                created_at: node.created_at || new Date().toISOString(),
                start_date: node.start_date || currentDate,
                due_date: node.due_date || currentDate,
              },
              selected: false, // 确保节点未被选中状态
            },
          };
          
          newNodes.push(newNode);
          
          // 如果有父节点，创建边
          if (parentId) {
            const newEdge: Edge = {
              id: `edge-${parentId}-${newNode.id}-${Date.now()}`, // 确保边ID唯一
              source: parentId,
              target: newNode.id,
              type: 'custom',
              data: { label: node.edgeLabel || '' },
              sourceHandle: 'right',
              targetHandle: 'left',
            };
            newEdges.push(newEdge);
          }
          
          // 处理子节点
          if (node.children && node.children.length > 0) {
            node.children.forEach((child, index) => {
              const childPosition = {
                x: position.x + NODE_WIDTH * 1.5, // 子节点向右偏移
                y: position.y + (index - node.children!.length / 2) * NODE_HEIGHT * 1.5, // 子节点垂直分布
              };
              processNode(child, newNode.id, childPosition, level + 1);
            });
          }
        };
        
        // 处理所有主题
        const theme = data.mindMaps[0]; // 只处理第一个主题
        
        // 如果主题有子节点，直接处理子节点
        if (theme.children && theme.children.length > 0) {
          // 计算初始位置，使节点居中
          const initialX = 100;
          const initialY = 100;
          
          theme.children.forEach((child, index) => {
            const childPosition = {
              x: initialX,
              y: initialY + index * NODE_HEIGHT * 2, // 垂直排列根节点
            };
            processNode(child, undefined, childPosition);
          });
        } else {
          // 如果主题没有子节点，创建一个主题节点
          const themeNode: FlowNode = {
            id: theme.id || `theme-${Date.now()}`, // 确保ID唯一
            type: 'custom',
            position: { x: 100, y: 100 },
            data: {
              label: theme.title,
              nodeData: {
                id: theme.id || `theme-${Date.now()}`,
                title: theme.title || '思维导图',
                description: '', // 主题没有description属性，设置为空字符串
                created_at: theme.created_at || new Date().toISOString(),
                start_date: currentDate,
                due_date: currentDate,
              },
              selected: false, // 确保节点未被选中状态
            },
          };
          
          newNodes.push(themeNode);
        }
        
        // 使用 Promise 和 setTimeout 确保状态更新后再执行后续操作
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 使用函数式更新确保状态完全替换而不是合并
        setNodes(() => [...newNodes]);
        setEdges(() => [...newEdges]);
        
        // 添加到历史记录
        addToHistory(newNodes, newEdges);
        
        // 延迟执行自动布局，确保节点已经渲染
        setTimeout(() => {
          // 确保 reactFlowInstance 已经初始化
          if (reactFlowInstance) {
            // 使用 fitView 确保所有节点都在视图中
            reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
            
            // 再次延迟执行自动布局，确保节点已经渲染
            setTimeout(() => {
              // 再次检查节点是否存在
              if (newNodes.length > 0) {
                handleAutoLayout();
              }
            }, 500);
          }
        }, 300);
        
        message.success('思维导图已加载');
      } else {
        message.error('加载失败：文件格式不正确或没有数据');
      }
    } catch (error) {
      console.error('加载思维导图时出错:', error);
      message.error('加载失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 处理连线点击事件
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    // 只设置选中状态
    setEdges((eds) => 
      eds.map((e) => ({
        ...e,
        selected: e.id === edge.id,
      }))
    );
  }, [setEdges]);

  // 处理连线双击事件
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    // 打开编辑模式并设置选中状态
    setEdges((eds) => 
      eds.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isEditing: e.id === edge.id,
        },
        selected: e.id === edge.id,
      }))
    );
    
    // 设置 showDelete 为 true，确保删除按钮显示
    setEdges((eds) => 
      eds.map((e) => {
        if (e.id === edge.id) {
          return {
            ...e,
            data: {
              ...e.data,
              showDelete: true,
            },
          };
        }
        return e;
      })
    );
  }, [setEdges]);

  // 添加键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果画布被锁定，不处理快捷键
      if (isLocked) return;
      
      // Ctrl+Z 撤销
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      }
      // Ctrl+Y 或 Ctrl+Shift+Z 重做
      if ((event.ctrlKey && event.key === 'y') || 
          (event.ctrlKey && event.shiftKey && event.key === 'z')) {
        event.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo, isLocked]);

  // 组件卸载时销毁编辑器实例
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  // 添加自动缓存功能
  useEffect(() => {
    // 自动保存到本地存储的函数
    const saveToLocalStorage = () => {
      try {
        // 如果画布被锁定或没有节点，不执行保存
        if (isLocked || nodes.length === 0) return;

        // 保存当前画布状态到 localStorage
        const canvasState = {
          nodes,
          edges,
          canvasId: currentCanvasId,
          canvasName: currentCanvasName,
          lastSaved: new Date().toISOString()
        };
        localStorage.setItem('mindmap_autosave', JSON.stringify(canvasState));
        
        // 记录保存时间
        localStorage.setItem('mindmap_last_saved', new Date().toISOString());
      } catch (error) {
        console.error('自动缓存失败:', error);
      }
    };

    // 监听页面可见性变化（处理标签页切换）
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveToLocalStorage();
      }
    };

    // 监听页面跳转
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      saveToLocalStorage();
      event.preventDefault();
      event.returnValue = '';
    };

    // 监听键盘事件（F1等）
    const handleKeyDown = (event: KeyboardEvent) => {
      // F1-F12, Alt, Ctrl+R 等可能导致页面刷新或离开的组合键
      if (
        (event.key >= 'F1' && event.key <= 'F12') ||
        (event.altKey && event.key === 'Left') ||
        (event.ctrlKey && event.key === 'r') ||
        (event.key === 'Escape')
      ) {
        saveToLocalStorage();
      }
    };

    // 定时自动保存（每分钟）
    const autoSaveInterval = setInterval(saveToLocalStorage, 60000);

    // 添加事件监听器
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('keydown', handleKeyDown);

    // 组件卸载时清理
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(autoSaveInterval);
    };
  }, [nodes, edges, isLocked, currentCanvasId, currentCanvasName]);

  // 组件加载时检查是否有自动保存的内容
  useEffect(() => {
    const loadAutoSavedContent = async () => {
      try {
        const savedContent = localStorage.getItem('mindmap_autosave');
        const lastSavedTime = localStorage.getItem('mindmap_last_saved');

        if (savedContent && lastSavedTime) {
          const { nodes: savedNodes, edges: savedEdges, canvasId, canvasName } = JSON.parse(savedContent);

          // 计算上次保存时间
          const lastSavedDate = new Date(lastSavedTime);
          const timeDiff = Math.floor((Date.now() - lastSavedDate.getTime()) / 1000 / 60); // 转换为分钟

          // 询问用户是否要恢复上次的内容
          Modal.confirm({
            title: '发现自动保存的内容',
            content: `检测到${timeDiff}分钟前保存的内容，是否恢复？`,
            okText: '恢复',
            cancelText: '不需要',
            onOk: () => {
              setNodes(savedNodes);
              setEdges(savedEdges);
              setCurrentCanvasId(canvasId);
              setCurrentCanvasName(canvasName);
              message.success('已恢复自动保存的内容');
            },
            onCancel: () => {
              // 用户选择不恢复时，清除自动保存的内容
              localStorage.removeItem('mindmap_autosave');
              localStorage.removeItem('mindmap_last_saved');
            }
          });
        }
      } catch (error) {
        console.error('加载自动保存内容失败:', error);
        message.error('加载自动保存内容失败');
      }
    };

    loadAutoSavedContent();
  }, []);

  // 保存当前画布到历史记录
  const saveToHistory = useCallback(() => {
    // 检查是否已存在相同ID的画布
    const existingCanvasIndex = canvasHistory.findIndex(canvas => canvas.id === currentCanvasId);
    
    const newCanvas = {
      id: currentCanvasId,
      name: currentCanvasName,
      nodes: nodes,
      edges: edges,
      createdAt: new Date().toISOString(),
    };
    
    if (existingCanvasIndex >= 0) {
      // 更新已存在的画布
      setCanvasHistory(prev => {
        const newHistory = [...prev];
        newHistory[existingCanvasIndex] = newCanvas;
        return newHistory;
      });
    } else {
      // 添加新画布到历史记录
      setCanvasHistory(prev => [...prev, newCanvas]);
    }
  }, [nodes, edges, canvasHistory, currentCanvasId, currentCanvasName]);

  // 创建新画布
  const createNewCanvas = useCallback(() => {
    // 保存当前画布到历史记录
    if (nodes.length > 0) {
      saveToHistory();
    }
    
    // 弹出对话框让用户输入画布名称
    Modal.confirm({
      title: '新建画布',
      content: (
        <Input 
          placeholder="请输入画布名称" 
          defaultValue="未命名画布" 
          onChange={(e) => setCurrentCanvasName(e.target.value)}
        />
      ),
      onOk: () => {
        // 清空当前画布
        setNodes([]);
        setEdges([]);
        // 重置历史记录
        setHistory({
          nodes: [[]],
          edges: [[]],
          currentIndex: 0,
          lastActionTime: Date.now(),
        });
        // 生成新的画布ID
        const newCanvasId = `canvas-${Date.now()}`;
        setCurrentCanvasId(newCanvasId);
        message.success(`已创建新画布: ${currentCanvasName}`);
      },
      okText: '确认',
      cancelText: '取消',
    });
  }, [nodes, edges, saveToHistory, currentCanvasName]);

  // 切换到历史画布
  const switchToCanvas = useCallback((canvas: typeof canvasHistory[0]) => {
    // 保存当前画布到历史记录
    if (nodes.length > 0) {
      saveToHistory();
    }
    // 加载选中的历史画布
    setNodes(canvas.nodes);
    setEdges(canvas.edges);
    setCurrentCanvasId(canvas.id);
    setCurrentCanvasName(canvas.name);
    // 重置历史记录
    setHistory({
      nodes: [canvas.nodes],
      edges: [canvas.edges],
      currentIndex: 0,
      lastActionTime: Date.now(),
    });
    message.success(`已切换到${canvas.name}`);
  }, [nodes, edges, saveToHistory]);

  // 初始化默认画布
  useEffect(() => {
    if (currentCanvasId === 'default' && canvasHistory.length === 0) {
      setCurrentCanvasName('未命名画布');
    }
  }, []);

  // 当锁定状态改变时更新所有节点
  useEffect(() => {
    setNodes((nds) => 
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          isLocked,
        },
      }))
    );
  }, [isLocked]);

  // 选择保存目录
  const selectSaveDirectory = async () => {
    try {
      // 检查是否支持 File System Access API
      if (!('showDirectoryPicker' in window)) {
        message.warning('您的浏览器不支持选择文件夹功能，将使用传统下载方式');
        return;
      }
      
      // 使用 showDirectoryPicker API 选择目录
      const showDirectoryPicker = (window as any).showDirectoryPicker;
      const directoryHandle = await showDirectoryPicker({
        id: 'mindMapSaveDirectory',
        mode: 'readwrite',
        startIn: 'documents',
      });
      
      // 保存目录句柄
      setSaveDirectoryHandle(directoryHandle);
      
      // 显示目录名称
      setSaveDirectoryPath(directoryHandle.name);
      
      message.success(`已选择保存路径: ${directoryHandle.name}`);
      
      // 将目录句柄保存到 localStorage (只保存名称，句柄无法序列化)
      localStorage.setItem('mindMapSaveDirectoryName', directoryHandle.name);
      
      return directoryHandle;
    } catch (error) {
      console.error('选择保存目录时出错:', error);
      message.error('选择保存目录失败');
      return null;
    }
  };
  
  // 组件挂载时提示用户选择保存目录
  useEffect(() => {
    const initSaveDirectory = async () => {
      // 检查是否支持 File System Access API
      if (!('showDirectoryPicker' in window)) {
        message.warning('您的浏览器不支持选择文件夹功能，将使用传统下载方式');
        return;
      }
      
      // 显示提示
      Modal.confirm({
        title: '选择保存路径',
        content: '请选择一个文件夹作为思维导图的保存路径，后续保存和导出的文件将直接保存到该路径',
        okText: '选择文件夹',
        cancelText: '取消',
        onOk: selectSaveDirectory,
      });
    };
    
    // 延迟执行，确保组件已完全挂载
    const timer = setTimeout(initSaveDirectory, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }} onClick={handleClick}>
      {/* 添加画布名称显示和编辑区域 - 移动到左上角 */}
      <div style={{ 
        position: 'absolute', 
        top: 20, 
        left: 20, 
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.8)',
        padding: '4px 12px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {isCanvasNameEditing ? (
          <Input
            value={currentCanvasName}
            onChange={(e) => setCurrentCanvasName(e.target.value)}
            onPressEnter={() => setIsCanvasNameEditing(false)}
            onBlur={() => setIsCanvasNameEditing(false)}
            autoFocus
            style={{ width: '200px' }}
          />
        ) : (
          <div 
            style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.3s',
            }}
            onClick={() => !isLocked && setIsCanvasNameEditing(true)}
            onMouseEnter={(e) => {
              if (!isLocked) {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {currentCanvasName}
            {!isLocked && (
              <EditOutlined 
                style={{ marginLeft: '8px', fontSize: '14px', opacity: 0.6 }} 
              />
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 1 }}>
        <Space direction="vertical" size="small" style={{ display: 'flex' }}>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px', 
            justifyContent: 'flex-end',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '8px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {/* 画布控制组 */}
            <Space.Compact>
              <Tooltip 
                title={isLocked ? "解锁画布" : "锁定画布"} 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Button
                  icon={isLocked ? <LockOutlined /> : <UnlockOutlined />}
                  onClick={() => setIsLocked(!isLocked)}
                  type={isLocked ? "primary" : "default"}
                >
                  {isLocked ? "解锁" : "锁定"}
                </Button>
              </Tooltip>
              <Tooltip 
                title="新建画布" 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Button
                  icon={<FileAddOutlined />}
                  onClick={createNewCanvas}
                  disabled={isLocked}
                >
                  新建
                </Button>
              </Tooltip>
              <Tooltip 
                title="历史画布" 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Dropdown
                  trigger={['click']}
                  disabled={canvasHistory.length === 0}
                  dropdownRender={() => (
                    <div style={{
                      backgroundColor: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      borderRadius: '4px',
                      padding: '4px 0',
                      minWidth: '200px',
                    }}>
                      {canvasHistory.length === 0 ? (
                        <div style={{ padding: '8px 12px', color: '#999' }}>
                          暂无历史画布
                        </div>
                      ) : (
                        canvasHistory.map(canvas => (
                          <div
                            key={canvas.id}
                            className="history-item"
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              transition: 'all 0.3s',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderBottom: '1px solid #f0f0f0',
                              backgroundColor: currentCanvasId === canvas.id ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = currentCanvasId === canvas.id ? 'rgba(24, 144, 255, 0.1)' : 'transparent';
                            }}
                          >
                            <div onClick={() => switchToCanvas(canvas)}>
                              <div style={{ fontWeight: 'bold' }}>{canvas.name}</div>
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                {new Date(canvas.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <Button 
                                type="text" 
                                size="small" 
                                icon={<EditOutlined />} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 弹出对话框修改画布名称
                                  let tempName = canvas.name;
                                  Modal.confirm({
                                    title: '修改画布名称',
                                    content: (
                                      <Input 
                                        defaultValue={canvas.name} 
                                        onChange={(e) => tempName = e.target.value}
                                      />
                                    ),
                                    onOk: () => {
                                      // 更新画布名称
                                      setCanvasHistory(prev => 
                                        prev.map(item => 
                                          item.id === canvas.id 
                                            ? { ...item, name: tempName } 
                                            : item
                                        )
                                      );
                                      // 如果是当前画布，也更新当前画布名称
                                      if (currentCanvasId === canvas.id) {
                                        setCurrentCanvasName(tempName);
                                      }
                                      message.success('画布名称已更新');
                                    },
                                    okText: '确认',
                                    cancelText: '取消',
                                  });
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                >
                  <Button icon={<HistoryOutlined />}>
                    历史 ({canvasHistory.length})
                  </Button>
                </Dropdown>
              </Tooltip>
            </Space.Compact>

            {/* 节点操作组 */}
            <Space.Compact>
              <Button 
                icon={<PlusOutlined />} 
                onClick={() => handleAddNode(selectedNode?.id)}
                disabled={isLocked}
                type={selectedNode ? "primary" : "default"}
              >
                {selectedNode ? '添加子节点' : '新增节点'}
              </Button>
            </Space.Compact>

            {/* 编辑操作组 */}
            <Space.Compact>
              <Tooltip 
                title="撤销 (Ctrl+Z)" 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Button 
                  icon={<UndoOutlined />} 
                  onClick={handleUndo}
                  disabled={isLocked || history.currentIndex <= 0}
                  style={{ transition: 'all 0.2s' }}
                />
              </Tooltip>
              <Tooltip 
                title="重做 (Ctrl+Y)" 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Button 
                  icon={<RedoOutlined />} 
                  onClick={handleRedo}
                  disabled={isLocked || history.currentIndex >= history.nodes.length - 1}
                  style={{ transition: 'all 0.2s' }}
                />
              </Tooltip>
              <Tooltip 
                title="自动布局" 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Button
                  icon={<LayoutOutlined />}
                  onClick={handleAutoLayout}
                  disabled={isLocked || nodes.length === 0}
                >
                  布局
                </Button>
              </Tooltip>
            </Space.Compact>

            {/* 文件操作组 */}
            <Space.Compact>
              <Button 
                icon={<SaveOutlined />} 
                onClick={handleSave}
                disabled={isLocked}
              >
                保存
              </Button>
              <Tooltip 
                title="加载思维导图" 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Button
                  icon={<UploadOutlined />}
                  onClick={handleLoad}
                  disabled={isLocked || nodes.length > 0}
                  className="load-button"
                >
                  加载
                </Button>
              </Tooltip>
              <Tooltip 
                title="导出为Markdown格式" 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Button 
                  icon={<FileOutlined />} 
                  onClick={async () => {
                    try {
                      const mindMapData = getMindMapData();
                      
                      // 检查是否在非 HTTPS 环境
                      const isNotSecure = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost';
                      
                      // 如果没有选择保存目录且环境支持，提示用户选择
                      if (!saveDirectoryHandle && 'showDirectoryPicker' in window && !isNotSecure) {
                        const shouldSelect = await new Promise<boolean>((resolve) => {
                          Modal.confirm({
                            title: '选择保存路径',
                            content: '您尚未选择保存路径，是否现在选择？',
                            okText: '选择',
                            cancelText: '取消',
                            onOk: () => resolve(true),
                            onCancel: () => resolve(false),
                          });
                        });
                        
                        if (shouldSelect) {
                          await selectSaveDirectory();
                        }
                      }
                      
                      const success = await saveToMarkdown(mindMapData, currentCanvasName, saveDirectoryHandle);
                      
                      if (success) {
                        if (saveDirectoryHandle) {
                          message.success(`Markdown文件已保存到 ${saveDirectoryPath} 目录`);
                        } else if (isNotSecure) {
                          message.success('成功导出为Markdown格式（使用传统下载方式）');
                        } else {
                          message.success('成功导出为Markdown格式');
                        }
                      } else {
                        message.error('导出失败');
                      }
                    } catch (error) {
                      console.error('导出Markdown时出错:', error);
                      message.error('导出失败');
                    }
                  }}
                  disabled={isLocked}
                >
                  导出MD
                </Button>
              </Tooltip>
            </Space.Compact>
            
            {/* 设置操作组 */}
            <Space.Compact>
              <Tooltip 
                title="布局与保存设置" 
                mouseEnterDelay={0.5}
                mouseLeaveDelay={0.1}
                destroyTooltipOnHide
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              >
                <Button 
                  icon={<SettingOutlined />} 
                  onClick={() => setDrawerVisible(true)}
                >
                  设置
                </Button>
              </Tooltip>
            </Space.Compact>
          </div>
        </Space>
      </div>
      
      {/* 布局与保存设置抽屉 */}
      <Drawer
        title="布局与保存设置"
        placement="right"
        closable={true}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={350}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 布局设置部分 */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '14px', color: '#333', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
              布局设置
            </h4>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#333' }}>布局方向</div>
              <Select 
                value={layoutDirection}
                style={{ width: '100%' }} 
                onChange={(value) => setLayoutDirection(value)}
                disabled={isLocked}
              >
                <Option value="LR">从左到右</Option>
                <Option value="RL">从右到左</Option>
                <Option value="TB">从上到下</Option>
                <Option value="BT">从下到上</Option>
              </Select>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#333' }}>节点间距</div>
              <Select
                value={nodeSpacing}
                style={{ width: '100%' }}
                onChange={(value) => setNodeSpacing(Number(value))}
                disabled={isLocked}
              >
                <Option value={50}>紧凑</Option>
                <Option value={100}>标准</Option>
                <Option value={150}>宽松</Option>
                <Option value={200}>超宽</Option>
              </Select>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#333' }}>层级间距</div>
              <Select
                value={rankSpacing}
                style={{ width: '100%' }}
                onChange={(value) => setRankSpacing(Number(value))}
                disabled={isLocked}
              >
                <Option value={80}>紧凑</Option>
                <Option value={150}>标准</Option>
                <Option value={200}>宽松</Option>
                <Option value={250}>超宽</Option>
              </Select>
            </div>
            
            <Button 
              type="primary" 
              icon={<LayoutOutlined />}
              onClick={handleAutoLayout}
              disabled={isLocked || nodes.length === 0}
              style={{ width: '100%', marginTop: '8px' }}
            >
              应用布局
            </Button>
          </div>
          
          {/* 自动保存设置部分 */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '14px', color: '#333', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
              自动保存设置
            </h4>
            
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <Switch 
                checked={autoSave} 
                onChange={setAutoSave} 
                style={{ marginRight: '12px' }}
                disabled={isLocked}
              />
              <span style={{ fontSize: '14px', color: autoSave ? '#1890ff' : '#666' }}>
                {autoSave ? '自动保存已开启' : '自动保存已关闭'}
              </span>
            </div>
            
            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
              开启自动保存后，系统会在您编辑思维导图时自动保存更改
            </p>
          </div>
          
          {/* 保存路径设置部分 */}
          <div>
            <h4 style={{ marginBottom: '16px', fontSize: '14px', color: '#333', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
              保存路径设置
            </h4>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#333' }}>当前保存路径</div>
              <div style={{ 
                backgroundColor: 'rgba(240, 240, 240, 0.8)', 
                padding: '8px 12px', 
                borderRadius: '4px',
                wordBreak: 'break-all'
              }}>
                {saveDirectoryPath}
              </div>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#333' }}>选择新的保存路径</div>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                选择一个文件夹作为思维导图和Markdown文件的保存位置
              </p>
              
              <Button 
                icon={<UploadOutlined />} 
                onClick={selectSaveDirectory}
                disabled={isLocked || !isDirectoryPickerSupported()}
                style={{ width: '100%' }}
              >
                选择保存路径
              </Button>
            </div>
            
            {!isDirectoryPickerSupported() && (
              <div style={{ 
                backgroundColor: 'rgba(250, 240, 210, 0.8)', 
                padding: '12px', 
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                <p style={{ fontSize: '12px', color: '#d48806', margin: 0 }}>
                  您的浏览器不支持文件夹选择功能，将使用传统下载方式保存文件。
                  建议使用最新版的Chrome、Edge或其他支持File System Access API的浏览器。
                </p>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {contextMenu.visible && (
        <div
          style={{
            position: 'absolute',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            borderRadius: '4px',
            padding: '4px 0',
            zIndex: 1000,
          }}
        >
          {contextMenu.items?.map((item) => (
            <Button
              key={item.key}
              type="text"
              icon={<PlusOutlined />}
              onClick={item.onClick}
              style={{ width: '100%', textAlign: 'left', padding: '4px 12px' }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={isLocked ? undefined : onNodesChange}
        onEdgesChange={isLocked ? undefined : onEdgesChange}
        onConnect={isLocked ? undefined : onConnect}
        onConnectStart={isLocked ? undefined : onConnectStart}
        onConnectEnd={isLocked ? undefined : onConnectEnd}
        onNodeClick={isLocked ? undefined : handleNodeClick}
        onNodeDoubleClick={isLocked ? undefined : handleNodeDoubleClick}
        onNodeContextMenu={isLocked ? undefined : handleContextMenu}
        onPaneContextMenu={isLocked ? undefined : handlePaneContextMenu}
        onPaneClick={() => !isLocked && setSelectedNode(null)}
        onEdgeClick={isLocked ? undefined : onEdgeClick}
        onEdgeDoubleClick={isLocked ? undefined : onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode={isLocked ? null : "Delete"}
        selectionKeyCode={isLocked ? null : "Control"}
        multiSelectionKeyCode={isLocked ? null : "Shift"}
        defaultEdgeOptions={{
          type: 'custom',
          animated: false,
          style: {
            strokeWidth: 1.5,
            stroke: '#b1b1b7',
          },
        }}
        connectionLineStyle={{
          stroke: '#1890ff',
          strokeWidth: 1.5,
          strokeDasharray: '5,5',
        }}
        connectionLineType={ConnectionLineType.Bezier}
        snapToGrid={true}
        snapGrid={[10, 10]}
        connectOnClick={!isLocked}
        elementsSelectable={!isLocked}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        zoomOnScroll={true}
        panOnScroll={true}
        panOnDrag={true}
        connectionMode={ConnectionMode.Loose}
      >
        <Background />
        <Controls 
          showInteractive={false}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            bottom: '20px',
            top: 'auto',
            left: '20px',
            right: 'auto',
            position: 'absolute',
          }}
        />
      </ReactFlow>

      <Modal
        title={selectedNode ? "编辑节点" : "新建节点"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        maskClosable={false}
        width={800}
        styles={{
          body: { maxHeight: '80vh', overflow: 'auto' }
        }}
        footer={[
          <div key="auto-save" style={{ float: 'left', display: 'flex', alignItems: 'center' }}>
            <Switch 
              checked={autoSave} 
              onChange={setAutoSave} 
              size="small"
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontSize: '12px', color: '#666' }}>
              {autoSave ? "关闭时自动保存" : "关闭时不保存"}
            </span>
          </div>,
          <Button key="cancel" onClick={handleModalCancel}>
            {autoSave ? "关闭并保存" : "关闭"}
          </Button>,
          <Button key="submit" type="primary" onClick={handleModalOk}>
            确定
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input />
          </Form.Item>
          
          <Divider orientation="left" plain style={{ margin: '12px 0' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>内容编辑</span>
          </Divider>
          
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', marginBottom: '16px' }}>
            <Toolbar
              editor={editor}
              defaultConfig={toolbarConfig}
              mode="default"
              style={{ borderBottom: '1px solid #d9d9d9' }}
            />
            <Editor
              defaultConfig={editorConfig}
              value={html}
              onCreated={setEditor}
              onChange={editor => setHtml(editor.getHtml())}
              mode="default"
              style={{ height: '300px', overflowY: 'hidden' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <Form.Item
              name="priority"
              label="优先级"
              style={{ flex: 1 }}
            >
              <Select>
                <Option value="low">低</Option>
                <Option value="medium">中</Option>
                <Option value="high">高</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="status"
              label="状态"
              style={{ flex: 1 }}
            >
              <Select>
                <Option value="todo">待办</Option>
                <Option value="in_progress">进行中</Option>
                <Option value="done">已完成</Option>
              </Select>
            </Form.Item>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="start_date"
              label="开始日期"
              style={{ flex: 1 }}
            >
              <Input type="date" />
            </Form.Item>
            <Form.Item
              name="due_date"
              label="截止日期"
              style={{ flex: 1 }}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const startDate = getFieldValue('start_date');
                    if (!startDate || !value || startDate <= value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('截止日期必须晚于开始日期'));
                  },
                }),
              ]}
            >
              <Input type="date" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

// 修改导出方式，避免匿名导出警告
const MindMapWithProvider = () => (
  <ReactFlowProvider>
    <GlobalStyles />
    <MindMap />
  </ReactFlowProvider>
);

export default MindMapWithProvider; 