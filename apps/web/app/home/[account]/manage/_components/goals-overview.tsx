import React from 'react';

function GoalsOverview() {
    return (
        <div className="bg-white p-4 rounded-lg shadow-lg">
            {/* "Review Transactions" Section */}
            <div className="text-center mb-4 p-4 rounded-lg" style={{ background: 'linear-gradient(135deg, #FDFBFE 0%, #F6F1FF 100%)', boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)' }}>
                <div className="bg-purple-100 p-4 rounded-full inline-block">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-purple-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <p className="mt-2 text-[16px] font-bold text-purple-700">Review 1 Transactions</p>
                <p className="text-[14px] text-gray-500">Ensure your transactions are categorized properly.</p>
            </div>

            {/* Transaction Overview Section */}
            <div className="p-4 rounded-lg bg-[#F5FBFF] border border-gray-200">
                <h3 className="text-[16px] font-medium text-gray-800">Gaols Overview</h3>
                <div className="mt-4 space-y-2 text-[14px]">

                    <div className="mt-2">
                        <h4 className="font-semibold text-gray-600">Expenses</h4>

                        <div className="flex justify-between">
                            <span>Alcohol, Bars</span>
                            <span>$150.00</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                            <div className="bg-[#A3D6FF] h-2.5 rounded-full" style={{ width: '10%' }}></div>
                        </div>

                        <div className="flex justify-between">
                            <span>Food</span>
                            <span>$1,000.00</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                            <div className="bg-[#A3D6FF] h-2.5 rounded-full" style={{ width: '50%' }}></div>
                        </div>
                    </div>

                    <div className="flex justify-between font-bold mt-2">
                        <span>Total</span>
                        <span className="text-[#0A91FF]">$950.00</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GoalsOverview;
