const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// 使用 DouCoachSystem 的 Supabase 連線
const supabaseUrl = 'https://urryrxlzyepwklzwwxwa.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
    console.log('🔥 Isis Report Generator Started');
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Method not allowed' 
            })
        };
    }

    try {
        const { student, reportContent, password } = JSON.parse(event.body);
        
        console.log('📋 Processing report for:', student.name);

        // 驗證必要資料
        if (!student || !reportContent || !password) {
            throw new Error('Missing required data');
        }

        // 生成 PDF 報告
        const pdfBase64 = await generatePDF(student, reportContent, password);
        
        // 觸發 n8n webhook 發送郵件
        await triggerN8nWebhook({
            orderNumber: student.orderNumber,
            studentName: student.name,
            studentEmail: student.email,
            planType: student.plan,
            pdfBase64: pdfBase64,
            password: password,
            reportDate: new Date().toISOString()
        });

        // 更新報告狀態為已發送
        await updateReportStatus(student.orderNumber, 'sent');

        // 記錄到資料庫 (可選)
        await logReportGeneration(student, reportContent);

        console.log('✅ Report generated and sent successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'PDF報告已生成並發送',
                orderNumber: student.orderNumber
            })
        };

    } catch (error) {
        console.error('❌ Error generating report:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error'
            })
        };
    }
};

// 生成 PDF 函數
async function generatePDF(student, reportContent, password) {
    const { jsPDF } = require('jspdf');
    
    try {
        console.log('📄 Generating PDF for:', student.name);
        
        // 創建 PDF 文檔
        const doc = new jsPDF({
            format: 'a4',
            unit: 'mm'
        });

        // 設定中文字體支援
        doc.setFont('helvetica');
        
        // 標題頁
        doc.setFontSize(24);
        doc.setTextColor(74, 20, 140); // #4A148C
        doc.text('✨ Isis DNA覺醒 ✨', 105, 30, { align: 'center' });
        
        doc.setFontSize(18);
        doc.setTextColor(255, 215, 0); // #FFD700
        doc.text('財富DNA編碼報告', 105, 50, { align: 'center' });

        // 學員資訊框
        doc.setDrawColor(221, 221, 221);
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(20, 70, 170, 40, 3, 3, 'FD');
        
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('👤 學員資訊', 25, 85);
        
        doc.setFontSize(12);
        doc.text(`姓名：${student.name}`, 25, 95);
        doc.text(`方案：${student.plan}`, 25, 102);
        doc.text(`生成日期：${new Date().toLocaleDateString('zh-TW')}`, 25, 109);

        // 浮水印
        doc.setGState(new doc.GState({ opacity: 0.1 }));
        doc.setFontSize(40);
        doc.setTextColor(240, 240, 240);
        doc.text(student.name, 105, 150, { align: 'center' });
        
        // 重設透明度
        doc.setGState(new doc.GState({ opacity: 1 }));

        // 新頁面 - 報告內容
        doc.addPage();
        
        doc.setFontSize(18);
        doc.setTextColor(74, 20, 140);
        doc.text('🌟 您專屬的財富DNA報告', 105, 30, { align: 'center' });

        let yPosition = 50;
        
        // 處理報告內容
        const sections = reportContent.split('========================').filter(s => s.trim());
        
        sections.forEach((section, index) => {
            const lines = section.trim().split('\n');
            const title = lines[0];
            const content = lines.slice(1).join('\n').trim();

            if (title && content) {
                // 檢查是否需要新頁面
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 30;
                }

                // 章節標題
                doc.setFontSize(14);
                doc.setTextColor(255, 215, 0);
                doc.text(title, 20, yPosition);
                yPosition += 10;

                // 章節內容
                doc.setFontSize(10);
                doc.setTextColor(51, 51, 51);
                
                // 分割長文字
                const textLines = doc.splitTextToSize(content, 170);
                textLines.forEach(line => {
                    if (yPosition > 270) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    doc.text(line, 20, yPosition);
                    yPosition += 5;
                });
                
                yPosition += 10; // 章節間距
            }
        });

        // 頁腳
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // 頁碼
            doc.setFontSize(8);
            doc.setTextColor(102, 102, 102);
            doc.text(`第 ${i} 頁，共 ${pageCount} 頁`, 105, 285, { align: 'center' });
            
            // 版權資訊（僅第一頁）
            if (i === 1) {
                doc.text('© 2025 Isis 女神 - 此報告為個人專屬，請勿分享', 105, 280, { align: 'center' });
            }
        }

        // 轉換為 base64
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        return pdfBase64;

    } catch (error) {
        console.error('PDF generation error:', error);
        throw error;
    }
}

// 觸發 n8n webhook
async function triggerN8nWebhook(data) {
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://n8n-samson-lin-u44764.vm.elestio.app/webhook/send-report-email';
    
    console.log('📧 Triggering n8n webhook for email sending');
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`n8n webhook failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ n8n webhook triggered successfully');
        return result;

    } catch (error) {
        console.error('❌ n8n webhook error:', error);
        throw error;
    }
}

// 更新報告狀態
async function updateReportStatus(orderNumber, status) {
    try {
        console.log(`📝 Updating report status for order ${orderNumber} to ${status}`);
        
        const { data, error } = await supabase
            .rpc('dnawakes_update_report_status', {
                p_order_number: orderNumber,
                p_status: status
            });

        if (error) {
            console.error('❌ Error updating report status:', error);
            // 不拋出錯誤，因為這不是關鍵功能
        } else {
            console.log('✅ Report status updated successfully');
        }
    } catch (error) {
        console.error('❌ Error updating report status:', error);
    }
}

// 記錄報告生成
async function logReportGeneration(student, reportContent) {
    try {
        const { data, error } = await supabase
            .from('isis_report_logs')
            .insert([
                {
                    order_number: student.orderNumber,
                    student_name: student.name,
                    student_email: student.email,
                    plan_type: student.plan,
                    report_content_length: reportContent.length,
                    generated_at: new Date().toISOString(),
                    status: 'completed'
                }
            ]);

        if (error) {
            console.error('Database logging error:', error);
            // 不拋出錯誤，因為這不是關鍵功能
        } else {
            console.log('📝 Report generation logged to database');
        }
    } catch (error) {
        console.error('Database logging error:', error);
    }
}