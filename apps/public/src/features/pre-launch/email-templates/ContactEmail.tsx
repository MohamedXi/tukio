import { Html, Body, Container, Heading, Text, Hr } from '@react-email/components';

interface ContactEmailProps {
  firstName: string;
  lastName: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  locale: string;
}

const containerStyle = {
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  backgroundColor: '#FAF7F2',
  padding: '32px',
  maxWidth: '600px',
  margin: '0 auto',
};

const headingStyle = {
  color: '#1C1917',
  fontSize: '20px',
  fontWeight: '600',
  marginBottom: '16px',
};

const textStyle = { color: '#44403C', fontSize: '14px', lineHeight: '1.6', margin: '0 0 8px' };
const messageStyle = { ...textStyle, whiteSpace: 'pre-wrap' as const, marginTop: '12px' };
const hrStyle = { borderColor: '#E7E5E4', margin: '16px 0' };

export function ContactEmail(props: ContactEmailProps) {
  const { firstName, lastName, email, category, subject, message, locale } = props;
  return (
    <Html lang={locale}>
      <Body>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Nouveau message — Contact tukio.one</Heading>
          <Text style={textStyle}>
            <strong>De :</strong> {firstName} {lastName}
          </Text>
          <Text style={textStyle}>
            <strong>Email :</strong> {email}
          </Text>
          <Text style={textStyle}>
            <strong>Type :</strong> {category}
          </Text>
          <Text style={textStyle}>
            <strong>Sujet :</strong> {subject}
          </Text>
          <Text style={textStyle}>
            <strong>Locale :</strong> {locale}
          </Text>
          <Hr style={hrStyle} />
          <Text style={textStyle}>
            <strong>Message :</strong>
          </Text>
          <Text style={messageStyle}>{message}</Text>
        </Container>
      </Body>
    </Html>
  );
}
