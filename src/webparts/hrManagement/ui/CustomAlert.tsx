import * as React from 'react';
import './CustomAlert.css';

// Type for the internal state
type AlertState = {
    isOpen: boolean;
    message: string;
};

// Global reference to the internal update function
let globalSetAlertState: ((state: AlertState) => void) | null = null;

// Global helper function to trigger the alert from anywhere
export const showAlert = (message: string): void => {
    if (globalSetAlertState) {
        globalSetAlertState({ isOpen: true, message });
    } else {
        // Fallback to native alert if the provider hasn't mounted yet
        console.warn("CustomAlertProvider not mounted. Falling back to native alert.");
        window.alert(message);
    }
};

export const CustomAlertProvider: React.FC = () => {
    const [alertState, setAlertState] = React.useState<AlertState>({
        isOpen: false,
        message: '',
    });

    // Bind the global setter to this component's state setter
    React.useEffect(() => {
        globalSetAlertState = setAlertState;
        return () => {
            globalSetAlertState = null;
        };
    }, []);

    const handleClose = () => {
        setAlertState({ isOpen: false, message: '' });
    };

    if (!alertState.isOpen) {
        return null;
    }

    return (
        <div className="custom-alert-overlay">
            <div className="custom-alert-box" role="alertdialog" aria-modal="true">
                <div className="custom-alert-icon">!</div>
                <div className="custom-alert-message">{alertState.message}</div>
                <button
                    className="custom-alert-button"
                    onClick={handleClose}
                    autoFocus
                >
                    Ok
                </button>
            </div>
        </div>
    );
};
