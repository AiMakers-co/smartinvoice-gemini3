import { logger } from "firebase-functions";
import { db } from "../shared/firebase";

// ============================================
// EMAIL SERVICE
// Sends emails and logs them to Firestore
// ============================================

interface EmailOptions {
  to: string;
  subject: string;
  content: string;
  from?: string;
}

/**
 * Send an email (placeholder - integrate with your email provider)
 * Options: SendGrid, Mailgun, AWS SES, Resend, etc.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, content, from = "support@finflow.io" } = options;
  
  try {
    // TODO: Integrate with your email provider
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({ to, from, subject, html: content });
    
    // For now, just log it (content included for debugging)
    logger.info("📧 Email would be sent:", { to, subject, from, contentLength: content.length });
    
    return true;
  } catch (error) {
    logger.error("Failed to send email:", { error, to, subject });
    return false;
  }
}

/**
 * Get email template from Firestore and substitute variables
 */
export async function getEmailTemplate(
  templateName: string, 
  variables: Record<string, any>
): Promise<{ subject: string; content: string } | null> {
  try {
    const snapshot = await db.collection("email_templates")
      .where("name", "==", templateName)
      .where("active", "==", true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      logger.warn(`Email template not found: ${templateName}`);
      return null;
    }
    
    const template = snapshot.docs[0].data();
    let content = template.content || "";
    let subject = template.subject || "";
    
    // Variable substitution with conditionals support
    const substituteVariables = (text: string): string => {
      // Handle {{#if var}}content{{else}}altContent{{/if}} blocks
      text = text.replace(
        /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, 
        (match, varName, ifContent, elseContent) => {
          return variables[varName] ? ifContent : elseContent;
        }
      );
      
      // Handle {{#if var}}content{{/if}} blocks (no else)
      text = text.replace(
        /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, 
        (match, varName, ifContent) => {
          return variables[varName] ? ifContent : "";
        }
      );
      
      // Handle simple {{variableName}} substitution
      text = text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variables[varName] !== undefined ? String(variables[varName]) : match;
      });
      
      return text;
    };
    
    content = substituteVariables(content);
    subject = substituteVariables(subject);
    
    return { subject, content };
  } catch (error) {
    logger.error("Error fetching email template:", { templateName, error });
    return null;
  }
}

/**
 * Log email to Firestore for tracking
 */
export async function logEmail(data: {
  to: string;
  subject: string;
  type: string;
  userId?: string;
  status: "sent" | "failed";
  metadata?: Record<string, any>;
  trigger?: string;
}) {
  try {
    await db.collection("email_logs").add({
      ...data,
      sentAt: new Date(),
      fromAddress: "support@finflow.io",
    });
  } catch (error) {
    logger.error("Failed to log email:", { error });
  }
}

