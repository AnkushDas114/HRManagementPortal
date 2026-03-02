import React, { useState, useEffect } from 'react';
import Modal from './CentralizedModal';

interface OrderTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnLabel: string;
  currentOrder: 'Default' | 'Ascending' | 'Descending';
  onSave: (order: 'Default' | 'Ascending' | 'Descending') => void;
}

const OrderTypeModal: React.FC<OrderTypeModalProps> = ({ isOpen, onClose, columnLabel, currentOrder, onSave }) => {
  const [selectedOrder, setSelectedOrder] = useState<'Default' | 'Ascending' | 'Descending'>(currentOrder);

  useEffect(() => {
    if (isOpen) {
      setSelectedOrder(currentOrder);
    }
  }, [isOpen, currentOrder]);

  const footer = (
    <>
      <button className="btn btn-primary px-4 py-1" onClick={() => onSave(selectedOrder)}>Save</button>
      <button className="btn btn-default px-4 py-1" onClick={onClose}>Cancel</button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Type Of Order" size="md" footer={footer} zIndex={1250} showMeta={false}>
      <div className="order-type-content" style={{ fontFamily: 'Segoe UI, sans-serif' }}>
        <div className="mb-3 d-flex align-items-center gap-1">
          <span style={{ fontSize: '14px', color: '#333333', fontWeight: 400 }}>Order Type</span>
          <i className="bi bi-info-circle" style={{ fontSize: '14px', color: '#2F5596' }}></i>
        </div>

        <div className="d-flex flex-column gap-3">
          <div className="form-check d-flex align-items-center gap-2 mb-0">
            <input 
              className="form-check-input mt-0" 
              type="radio" 
              name="orderType" 
              id="order-default" 
              checked={selectedOrder === 'Default'} 
              onChange={() => setSelectedOrder('Default')} 
            />
            <label className="form-check-label" htmlFor="order-default" style={{ cursor: 'pointer' }}>Default Order</label>
          </div>

          <div className="form-check d-flex align-items-center gap-2 mb-0">
            <input 
              className="form-check-input mt-0" 
              type="radio" 
              name="orderType" 
              id="order-ascending" 
              checked={selectedOrder === 'Ascending'} 
              onChange={() => setSelectedOrder('Ascending')} 
            />
            <label className="form-check-label" htmlFor="order-ascending" style={{ cursor: 'pointer' }}>Ascending Order</label>
          </div>

          <div className="form-check d-flex align-items-center gap-2 mb-0">
            <input 
              className="form-check-input mt-0" 
              type="radio" 
              name="orderType" 
              id="order-descending" 
              checked={selectedOrder === 'Descending'} 
              onChange={() => setSelectedOrder('Descending')} 
            />
            <label className="form-check-label" htmlFor="order-descending" style={{ cursor: 'pointer' }}>Descending Order</label>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OrderTypeModal;
