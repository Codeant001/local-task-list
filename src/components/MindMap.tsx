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
import { Button, Space, Modal, Form, Input, Select, Tooltip, Divider, message, Switch } from 'antd';
import { 
  PlusOutlined, 
  LayoutOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  UndoOutlined, 
  RedoOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { MindMapData, MindMapNode, MindMapTheme } from '../types/MindMap';
import { saveToFile, loadFromFile, saveToMarkdown } from '../utils/fileUtils';
import CustomNode from './CustomNode';
// 导入wangEditor相关组件
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor';

const { Option } = Select;

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
    curvature: 0.25, // 控制曲线的弯曲程度
  });

  // 计算连线中心点，用于放置文字和按钮
  useEffect(() => {
    setEdgeCenter({ x: labelX, y: labelY });
  }, [labelX, labelY]);

  // 响应外部 isEditing 属性变化
  useEffect(() => {
    if ((data as CustomEdgeData)?.isEditing) {
      setIsEditing(true);
      // 使用 setTimeout 确保 DOM 已更新
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [data]);

  // 处理文本编辑完成
  const handleTextChange = () => {
    setIsEditing(false);
    const newLabel = inputRef.current?.value || '';
    setLabel(newLabel);
    
    // 更新边的数据
    setEdges((edges) => 
      edges.map((edge) => {
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

  // 处理开始编辑
  const handleStartEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsEditing(true);
    // 使用 setTimeout 确保 DOM 已更新
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
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
        }}
      />
      
      {/* 连线文字 */}
      {!isEditing && (
        <foreignObject
          width={100}
          height={40}
          x={edgeCenter.x - 50}
          y={edgeCenter.y - 20}
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
                padding: '2px 4px',
                fontSize: '10px',
                background: selected ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                borderRadius: '4px',
                color: selected ? '#1890ff' : '#666',
                maxWidth: '100px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                transition: 'all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
              }}
            >
              {label || (selected ? '点击编辑' : '')}
            </div>
          </div>
        </foreignObject>
      )}
      
      {/* 编辑输入框 */}
      {isEditing && (
        <foreignObject
          width={120}
          height={40}
          x={edgeCenter.x - 60}
          y={edgeCenter.y - 20}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            style={{
              background: 'white',
              padding: '2px',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <input
              ref={inputRef}
              defaultValue={label}
              onBlur={handleTextChange}
              onKeyPress={(e) => e.key === 'Enter' && handleTextChange()}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '10px',
                padding: '2px 4px',
                textAlign: 'center',
              }}
            />
          </div>
        </foreignObject>
      )}
      
      {/* 操作按钮 - 仅在选中时显示 */}
      {selected && !isEditing && (
        <foreignObject
          width={50}
          height={24}
          x={edgeCenter.x - 25}
          y={edgeCenter.y + 15}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <button
              onClick={handleStartEdit}
              style={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                fontSize: '10px',
              }}
            >
              <EditOutlined style={{ fontSize: '10px' }} />
            </button>
            <button
              onClick={handleDelete}
              style={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                fontSize: '10px',
              }}
            >
              <DeleteOutlined style={{ fontSize: '10px', color: '#ff4d4f' }} />
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
const NODE_WIDTH = 140;
const NODE_HEIGHT = 35;

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

const initialNodes: FlowNode[] = [
  {
    id: 'node-1',
    type: 'custom',
    data: { 
      label: '我的任务',
      nodeData: {
        id: 'node-1',
        title: '我的任务',
        created_at: new Date().toISOString(),
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
      }
    },
    position: { x: 250, y: 0 },
  },
];

const MindMap: React.FC = () => {
  const [nodes, setNodes, onNodesChangeDefault] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeDefault] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState(LAYOUT_DIRECTION);
  const [nodeSpacing, setNodeSpacing] = useState(100); // 节点间距
  const [rankSpacing, setRankSpacing] = useState(150); // 层级间距
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
  
  const [form] = Form.useForm();
  const reactFlowInstance = useReactFlow();
  const newNodeRef = useRef<FlowNode | null>(null);
  const connectingHandleRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const isUndoingRef = useRef(false);
  const lastHistoryUpdateRef = useRef<number>(Date.now());
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const [html, setHtml] = useState<string>('');
  const [autoSave, setAutoSave] = useState<boolean>(true); // 默认开启自动保存
  
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
    insertKeys: {
      index: 23,
      keys: ['todo'], // 添加待办事项功能
    },
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
      nodesep: isHorizontal ? nodeSpacing : nodeSpacing / 2, // 节点之间的水平间距
      ranksep: isHorizontal ? rankSpacing : rankSpacing / 1.5, // 层级之间的垂直间距
      marginx: 50, // 图的水平边距
      marginy: 50, // 图的垂直边距
      align: 'DL', // 对齐方式：DL=向下和向左
      acyclicer: 'greedy', // 处理循环依赖
      ranker: 'network-simplex', // 布局算法
    });

    // 添加节点
    nodesWithOriginalPositions.forEach((node) => {
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
        style: {
          ...node.style,
          transition: 'transform 0.5s ease-out',
        }
      };
    });
    
    setNodes(layoutedNodes);
    
    // 使用 fitView 确保所有节点都在视图中
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
    }, 50);
  }, [nodes, edges, setNodes, reactFlowInstance, layoutDirection, nodeSpacing, rankSpacing]);

  // 处理连接事件
  const onConnect = useCallback((params: Connection) => {
    console.log('连接参数:', params); // 调试信息
    
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
        console.log('连接开始，方向:', handleId); // 调试信息
      }
    },
    [nodes]
  );

  // 处理连接结束事件
  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!event || !('clientX' in event) || !('clientY' in event)) return;
      
      // 检查目标是否为画布（空白区域）
      const targetIsPane = (event.target as Element)?.classList?.contains('react-flow__pane');
      
      // 检查目标是否为节点
      const targetIsNode = (event.target as Element)?.closest('.react-flow__node');
      
      // 只有在拖动到空白区域且不是节点时才创建新节点
      if (targetIsPane && !targetIsNode && selectedNode) {
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // 使用保存的连接起始方向
        const sourceHandleId = connectingHandleRef.current;
        console.log('连接结束，起始连接点:', sourceHandleId); // 调试信息
        
        if (!sourceHandleId) {
          console.log('没有有效的连接点，不创建新节点');
          return; // 如果没有有效的连接点，不创建新节点
        }
        
        // 计算新节点与当前节点的距离
        // 水平和垂直方向使用不同的距离，使布局更加美观
        const HORIZONTAL_OFFSET = NODE_WIDTH * 2; // 水平方向距离为节点宽度的2倍
        const VERTICAL_OFFSET = NODE_HEIGHT * 3; // 垂直方向距离为节点高度的3倍
        
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
        
        // 不再弹出编辑界面，保持与新增节点行为一致
      }
      // 重置连接起始方向
      connectingHandleRef.current = null;
    },
    [selectedNode, reactFlowInstance, setNodes, setEdges]
  );

  // 处理节点点击事件
  const handleNodeClick: NodeMouseHandler = (event, node) => {
    event.stopPropagation();
    setSelectedNode(node);
    
    // 填充表单数据
    const nodeData = node.data.nodeData;
    form.setFieldsValue({
      title: nodeData.title || '',
      priority: nodeData.priority || undefined,
      status: nodeData.status || undefined,
      start_date: nodeData.start_date || '',
      due_date: nodeData.due_date || '',
    });
    
    // 更新富文本编辑器内容
    setHtml(nodeData.description || '');
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
        },
        {
          key: 'add-theme',
          label: '添加新主题',
          onClick: handleAddTheme,
        },
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
        },
        {
          key: 'add-theme',
          label: '添加新主题',
          onClick: handleAddTheme,
        },
      ],
    });
  };

  const handleClick = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
    });
    // 注意：不在这里清除selectedNode，因为已经在onPaneClick中处理了
    // 这样可以避免点击节点后立即清除选中状态
  };

  const handleAddNode = (parentId?: string) => {
    const currentDate = new Date().toISOString().split('T')[0];
    const newNodeId = `node-${Date.now()}`;
    
    let newNodePosition = { x: 100, y: 100 };
    
    // 如果有父节点，则计算新节点位置
    if (parentId) {
      const parentNode = nodes.find(node => node.id === parentId);
      if (parentNode) {
        // 计算新节点与当前节点的距离
        const HORIZONTAL_OFFSET = NODE_WIDTH * 2; // 水平方向距离为节点宽度的2倍
        
        newNodePosition = {
          x: parentNode.position.x + HORIZONTAL_OFFSET,
          y: parentNode.position.y,
        };
        
        // 创建连接边
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
        }
      },
      position: newNodePosition,
    };
    
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    
    // 只有在添加子节点时才弹出编辑界面
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

  const handleSave = async () => {
    try {
      // 创建当前思维导图数据
      const currentTheme: MindMapTheme = {
        id: 'theme-1',
        title: '思维导图',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        children: [],
      };
      
      // 将节点数据转换为MindMapNode结构
      const nodeMap = new Map<string, MindMapNode>();
      const rootNodes: MindMapNode[] = [];
      
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
      
      // 保存到JSON文件
      const jsonSuccess = await saveToFile(mindMapData);
      
      // 保存到Markdown文件
      const mdSuccess = await saveToMarkdown(mindMapData);
      
      if (jsonSuccess && mdSuccess) {
        message.success('思维导图已保存为JSON和Markdown格式');
      } else if (jsonSuccess) {
        message.success('思维导图已保存为JSON格式，但Markdown格式保存失败');
      } else if (mdSuccess) {
        message.success('思维导图已保存为Markdown格式，但JSON格式保存失败');
      } else {
        message.error('保存失败');
      }
    } catch (error) {
      console.error('保存思维导图时出错:', error);
      message.error('保存失败');
    }
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
                x: position.x + 250, // 子节点向右偏移
                y: position.y + (index - node.children!.length / 2) * 100, // 子节点垂直分布
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
              y: initialY + index * 150, // 垂直排列根节点
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
    setEdges((eds) => 
      eds.map((e) => {
        if (e.id === edge.id) {
          return {
            ...e,
            selected: true,
          };
        }
        return {
          ...e,
          selected: false,
        };
      })
    );
  }, [setEdges]);

  // 处理连线双击事件
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    // 打开编辑模式
    setEdges((eds) => 
      eds.map((e) => {
        if (e.id === edge.id) {
          return {
            ...e,
            data: {
              ...e.data,
              isEditing: true,
            },
            selected: true,
          };
        }
        return e;
      })
    );
  }, [setEdges]);

  // 添加键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [handleUndo, handleRedo]);

  // 组件卸载时销毁编辑器实例
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  return (
    <div style={{ width: '100vw', height: '100vh' }} onClick={handleClick}>
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 1 }}>
        <Space direction="vertical" size="small" style={{ display: 'flex' }}>
          <Space>
            <Button 
              icon={<PlusOutlined />} 
              onClick={() => handleAddNode(selectedNode?.id)}
            >
              {selectedNode ? '添加子节点' : '新增节点'}
            </Button>
            <Tooltip title="撤销 (Ctrl+Z)">
              <Button 
                icon={<UndoOutlined />} 
                onClick={handleUndo}
                disabled={history.currentIndex <= 0}
                style={{ transition: 'all 0.2s' }}
              />
            </Tooltip>
            <Tooltip title="重做 (Ctrl+Y)">
              <Button 
                icon={<RedoOutlined />} 
                onClick={handleRedo}
                disabled={history.currentIndex >= history.nodes.length - 1}
                style={{ transition: 'all 0.2s' }}
              />
            </Tooltip>
            <Button icon={<LayoutOutlined />} onClick={handleAutoLayout}>
              自动布局
            </Button>
            <Button icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
            <Button icon={<UploadOutlined />} onClick={handleLoad} className="load-button">加载</Button>
            <Tooltip title={autoSave ? "自动保存已开启" : "自动保存已关闭"}>
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8px' }}>
                <span style={{ marginRight: '8px', fontSize: '12px', color: '#666' }}>自动保存</span>
                <Switch 
                  checked={autoSave} 
                  onChange={setAutoSave} 
                  size="small"
                  style={{ background: autoSave ? '#1890ff' : '#bfbfbf' }}
                />
              </div>
            </Tooltip>
          </Space>
          <Space>
            <span>布局方向:</span>
            <Select 
              value={layoutDirection}
              style={{ width: 120 }} 
              onChange={(value) => setLayoutDirection(value)}
            >
              <Option value="LR">从左到右</Option>
              <Option value="RL">从右到左</Option>
              <Option value="TB">从上到下</Option>
              <Option value="BT">从下到上</Option>
            </Select>
            <span>节点间距:</span>
            <Select
              value={nodeSpacing}
              style={{ width: 100 }}
              onChange={(value) => setNodeSpacing(Number(value))}
            >
              <Option value={50}>紧凑</Option>
              <Option value={100}>标准</Option>
              <Option value={150}>宽松</Option>
              <Option value={200}>超宽</Option>
            </Select>
            <span>层级间距:</span>
            <Select
              value={rankSpacing}
              style={{ width: 100 }}
              onChange={(value) => setRankSpacing(Number(value))}
            >
              <Option value={80}>紧凑</Option>
              <Option value={150}>标准</Option>
              <Option value={200}>宽松</Option>
              <Option value={250}>超宽</Option>
            </Select>
          </Space>
        </Space>
      </div>

      {/* 连接提示信息 */}
      <div style={{ 
        position: 'absolute', 
        top: 20, 
        left: 20, 
        zIndex: 1,
        background: 'rgba(255, 255, 255, 0.8)',
        padding: '8px 12px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontSize: '12px',
        color: '#666',
      }}>
        <div>连接节点：</div>
        <div>1. 从节点的连接点拖动到另一个节点</div>
        <div>2. 或选中一个节点，再点击另一个节点进行连接</div>
      </div>

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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onPaneClick={() => setSelectedNode(null)}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode="Delete"
        selectionKeyCode="Control"
        multiSelectionKeyCode="Shift"
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
        connectOnClick={true}
        elementsSelectable={true}
        nodesDraggable={true}
        nodesConnectable={true}
        zoomOnScroll={true}
        panOnScroll={true}
        panOnDrag={true}
        connectionMode={ConnectionMode.Loose}
      >
        <Background />
        <Controls />
      </ReactFlow>

      <Modal
        title={selectedNode ? "编辑节点" : "新建节点"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
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