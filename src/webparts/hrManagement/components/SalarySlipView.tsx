import * as React from 'react';
import { Employee } from '../types';
import { numberToWords } from '../utils/numberToWords';

interface SalarySlipViewProps {
    employee: Employee;
    formData: {
        month: string;
        year: string;
        basic: number;
        hra: number;
        allowances: number;
        deductions: number;
        bankName: string;
        accountNumber: string;
        ifscCode: string;
        pan: string;
        workingDays: number;
        paidDays: number;
        monthlyCtc: number;
        gross: number;
        employerPF: number;
        employeePF: number;
        bonus: number;
        insurance: number;
        esi: number;
        employerEsi: number;
        inhand: number;
    };
}

export const SalarySlipView: React.FC<SalarySlipViewProps> = ({ employee, formData }) => {
    return (
        <div id="salary-slip-print-template" className="p-4 bg-white" style={{ width: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '12px', border: '1px solid #dee2e6' }}>
            <style>
                {`
                @media print {
                    body * { visibility: hidden; }
                    #salary-slip-print-template, #salary-slip-print-template * { visibility: visible; }
                    #salary-slip-print-template { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
                }
                .slip-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .slip-table th, .slip-table td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
                .slip-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #2f5596; padding-bottom: 15px; }
                .company-logo { font-size: 28px; font-weight: bold; color: #2f5596; display: flex; align-items: center; }
                .company-logo span { font-style: italic; }
                .company-info { text-align: center; flex-grow: 1; }
                .company-name { font-size: 18px; font-weight: bold; margin-bottom: 3px; }
                .company-address { font-size: 11px; color: #666; }
                .section-title { background-color: #f8f9fa; font-weight: bold; text-align: center; }
                .total-row { font-weight: bold; background-color: #f8f9fa; }
                .net-salary-box { border: 2px solid #333; padding: 10px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; }
                `}
            </style>

            {/* Header */}
            <div className="slip-header">
                <div className="company-logo">
                    <span>S</span>malsus
                </div>
                <div className="company-info">
                    <div className="company-name">Smalsus Infolabs Pvt .Ltd.</div>
                    <div className="company-address">
                        Kirti Tower, Plot no 13&13C, Techzone 4, Greater Noida west, <br />
                        Uttar Pradesh 201009
                    </div>
                </div>
            </div>

            {/* Employee Info Table */}
            <table className="slip-table">
                <thead>
                    <tr>
                        <th colSpan={2} className="section-title">Salary Slip</th>
                        <th className="section-title">Month</th>
                        <th className="text-center">{formData.month.substring(0, 3)}-{formData.year.substring(2)}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td width="20%">Employee Name</td>
                        <td width="30%">{employee.name}</td>
                        <td width="25%">Date of Joining</td>
                        <td width="25%">{employee.joiningDate || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td>Employee Code</td>
                        <td>{employee.id}</td>
                        <td>Total Working Days</td>
                        <td>{formData.workingDays}</td>
                    </tr>
                    <tr>
                        <td>Designation</td>
                        <td>{employee.position || 'Software Engineer'}</td>
                        <td>Paid days</td>
                        <td>{formData.paidDays}</td>
                    </tr>
                    <tr>
                        <td>PAN</td>
                        <td>{formData.pan}</td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Bank Account Number</td>
                        <td>{formData.accountNumber}</td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Bank Name</td>
                        <td>{formData.bankName}</td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>IFSC Code</td>
                        <td>{formData.ifscCode}</td>
                        <td></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>

            {/* Earnings and Deductions Table */}
            <div style={{ display: 'flex', gap: '0' }}>
                <table className="slip-table" style={{ width: '50%', marginBottom: 0 }}>
                    <thead>
                        <tr className="section-title">
                            <th>Income</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Basic Salary</td>
                            <td className="text-end">{formData.basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <td>HRA</td>
                            <td className="text-end">{formData.hra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <td>Others</td>
                            <td className="text-end">{formData.allowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style={{ height: '100px' }}><td></td><td></td></tr>
                        <tr className="total-row">
                            <td>Total</td>
                            <td className="text-end">{(formData.basic + formData.hra + formData.allowances).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>
                <table className="slip-table" style={{ width: '50%', marginBottom: 0, borderLeft: 0 }}>
                    <thead>
                        <tr className="section-title">
                            <th>Deductions</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Employee - PF contribution</td>
                            <td className="text-end">{formData.employeePF.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style={{ height: '30px' }}><td></td><td></td></tr>
                        <tr style={{ height: '30px' }}><td></td><td></td></tr>
                        <tr style={{ height: '100px' }}><td></td><td></td></tr>
                        <tr className="total-row">
                            <td>Total</td>
                            <td className="text-end">{formData.employeePF.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Net Salary Section */}
            <div className="net-salary-box">
                <div style={{ fontWeight: 'bold' }}>Net Salary</div>
                <div style={{ fontWeight: 'bold' }}>{formData.inhand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>

            <div className="mt-3" style={{ display: 'flex', border: '1px solid #333', borderTop: 0 }}>
                <div style={{ width: '40%', padding: '10px', borderRight: '1px solid #333', fontWeight: 'bold' }}>
                    Rs- {formData.inhand.toLocaleString('en-IN')}
                </div>
                <div style={{ width: '60%', padding: '10px', fontStyle: 'italic' }}>
                    {numberToWords(formData.inhand)}
                </div>
            </div>

            <div className="mt-4 text-center" style={{ fontSize: '10px', color: '#666' }}>
                Note: This is computer generated slip and does not require any signature.
            </div>
        </div>
    );
};
