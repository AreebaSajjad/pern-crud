import { useState, createContext, useContext } from 'react';

const ConfirmContext = createContext();

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);

  const askConfirm = (message, title = 'Are you sure?') => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        onConfirm: () => {
          setDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          resolve(false);
        },
      });
    });
  };

  return (
    <ConfirmContext.Provider value={{ askConfirm }}>
      {children}
      {dialog && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>{dialog.title}</h3>
            <p>{dialog.message}</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={dialog.onCancel}>Cancel</button>
              <button className="btn-delete confirm-danger" onClick={dialog.onConfirm}>Yes, Continue</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};