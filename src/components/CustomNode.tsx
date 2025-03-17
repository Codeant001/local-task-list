import React from 'react';
import { Handle, Position } from 'reactflow';
import { Tooltip } from 'antd';
import { MindMapNode } from '../types/MindMap';

// 自定义节点属性接口
interface CustomNodeProps {
  data: {
    label: string;
    nodeData: MindMapNode;
    isLocked?: boolean;
  };
  selected?: boolean;
  id: string;
}

// 从HTML中提取纯文本
const extractTextFromHtml = (html: string): string => {
  if (!html) return '';
  
  // 创建临时DOM元素
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // 获取纯文本内容
  const text = tempDiv.textContent || tempDiv.innerText || '';
  
  // 返回截断的文本
  return text.length > 50 ? text.substring(0, 50) + '...' : text;
};

const CustomNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const { nodeData, isLocked } = data;
  const startDate = nodeData.start_date ? new Date(nodeData.start_date) : null;
  const dueDate = nodeData.due_date ? new Date(nodeData.due_date) : null;
  
  // 格式化日期为 MM-DD 格式
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };
  
  // 计算日期状态
  const getDueDateStatus = () => {
    if (!dueDate) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      return 'overdue';
    } else if (dueDate.getTime() === today.getTime()) {
      return 'today';
    } else {
      const diffTime = Math.abs(dueDate.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 3) {
        return 'soon';
      }
    }
    return '';
  };
  
  const dueDateStatus = getDueDateStatus();
  
  // 根据优先级获取颜色
  const getPriorityColor = () => {
    switch (nodeData.priority) {
      case 'high':
        return '#f5222d';
      case 'medium':
        return '#faad14';
      case 'low':
        return '#52c41a';
      default:
        return '#d9d9d9';
    }
  };
  
  // 根据状态获取颜色
  const getStatusColor = () => {
    switch (nodeData.status) {
      case 'done':
        return '#52c41a';
      case 'in_progress':
        return '#1890ff';
      case 'todo':
        return '#faad14';
      default:
        return '#d9d9d9';
    }
  };
  
  // 定义连接点样式
  const handleStyle = {
    width: 6,
    height: 6,
    border: `1px solid ${selected ? '#1890ff' : '#999'}`,
    background: selected ? '#1890ff' : '#fff',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    opacity: 0.7, // 降低连接点的不透明度，使其不那么显眼
  };
  
  // 提取描述的纯文本摘要
  const descriptionSummary = extractTextFromHtml(nodeData.description || '');
  
  return (
    <div
      style={{
        padding: '6px 8px',
        borderRadius: '4px',
        background: 'white',
        border: `${selected ? '2px' : '1px'} solid ${selected ? '#1890ff' : '#ddd'}`,
        boxShadow: selected 
          ? '0 0 8px rgba(24, 144, 255, 0.5), 0 2px 4px rgba(0, 0, 0, 0.1)' 
          : '0 1px 3px rgba(0, 0, 0, 0.1)',
        width: '112px',
        height: 'auto',
        transform: 'scale(1)',
        transition: 'border 0.3s, box-shadow 0.3s',
        position: 'relative',
        zIndex: selected ? 10 : 1, // 选中的节点置于顶层
      }}
    >
      {/* 顶部连接点 */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        style={handleStyle}
        isConnectable={!isLocked}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={handleStyle}
        isConnectable={!isLocked}
      />
      
      {/* 左侧连接点 */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={handleStyle}
        isConnectable={!isLocked}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={handleStyle}
        isConnectable={!isLocked}
      />
      
      {/* 右侧连接点 */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={handleStyle}
        isConnectable={!isLocked}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        style={handleStyle}
        isConnectable={!isLocked}
      />
      
      {/* 底部连接点 */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={handleStyle}
        isConnectable={!isLocked}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        style={handleStyle}
        isConnectable={!isLocked}
      />
      
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: '2px',
          color: selected ? '#1890ff' : '#333',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textAlign: 'center',
          fontSize: '11px',
        }}
        title={nodeData.title}
      >
        {nodeData.title}
      </div>
      
      {/* 描述摘要 */}
      {descriptionSummary && (
        <div
          style={{
            fontSize: '9px',
            color: '#666',
            marginBottom: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          title={extractTextFromHtml(nodeData.description || '')}
        >
          {descriptionSummary}
        </div>
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
        {nodeData.priority && (
          <Tooltip 
            title={`优先级: ${nodeData.priority === 'high' ? '高' : nodeData.priority === 'medium' ? '中' : '低'}`} 
            mouseEnterDelay={0.5} 
            mouseLeaveDelay={0.1} 
            destroyTooltipOnHide
            getPopupContainer={() => document.body}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: getPriorityColor(),
              }}
            />
          </Tooltip>
        )}
        
        {nodeData.status && (
          <Tooltip 
            title={`状态: ${nodeData.status === 'done' ? '已完成' : nodeData.status === 'in_progress' ? '进行中' : '待办'}`} 
            mouseEnterDelay={0.5} 
            mouseLeaveDelay={0.1} 
            destroyTooltipOnHide
            getPopupContainer={() => document.body}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: getStatusColor(),
              }}
            />
          </Tooltip>
        )}
        
        <div
          style={{
            fontSize: '8px',
            color: selected ? '#1890ff' : '#999',
            marginLeft: 'auto',
            transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {startDate && (
            <Tooltip 
              title={`开始日期: ${nodeData.start_date}`} 
              mouseEnterDelay={0.5} 
              mouseLeaveDelay={0.1} 
              destroyTooltipOnHide
              getPopupContainer={() => document.body}
            >
              <span>{formatDate(startDate)}</span>
            </Tooltip>
          )}
          {startDate && dueDate && <span> - </span>}
          {dueDate && (
            <Tooltip 
              title={`截止日期: ${nodeData.due_date}`} 
              mouseEnterDelay={0.5} 
              mouseLeaveDelay={0.1} 
              destroyTooltipOnHide
              getPopupContainer={() => document.body}
            >
              <span
                style={{
                  color: dueDateStatus === 'overdue' ? '#f5222d' : 
                         dueDateStatus === 'today' ? '#fa8c16' : 
                         dueDateStatus === 'soon' ? '#faad14' : 
                         selected ? '#1890ff' : '#999',
                }}
              >
                {formatDate(dueDate)}
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomNode; 