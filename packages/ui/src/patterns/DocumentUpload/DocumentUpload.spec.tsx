import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { DocumentUpload } from './DocumentUpload';

const labels = {
  uploaded: 'Uploaded',
  replace: 'Replace',
  remove: 'Remove file',
  dropZoneText: 'Drop your file here or',
  dropZoneAction: 'browse',
};

const baseProps = {
  label: 'ID card',
  formats: 'JPG · PNG · PDF · 5 MB',
  instructions: 'National ID, passport, or residence permit',
  labels,
};

describe('DocumentUpload', () => {
  it('renders empty drop zone when no file', () => {
    render(<DocumentUpload {...baseProps} file={null} onChange={() => {}} />);
    expect(screen.getByText(/Drop your file here or/)).toBeInTheDocument();
    expect(screen.getByText('browse')).toBeInTheDocument();
    expect(screen.queryByText('Uploaded')).not.toBeInTheDocument();
  });

  it('shows required asterisk when required', () => {
    render(<DocumentUpload {...baseProps} required file={null} onChange={() => {}} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders uploaded state with filename, size, badge, replace + remove', () => {
    const file = new File(['x'.repeat(2 * 1024 * 1024)], 'cni.jpg', {
      type: 'image/jpeg',
    });
    render(<DocumentUpload {...baseProps} file={file} onChange={() => {}} />);
    expect(screen.getByText('cni.jpg')).toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('2.0 Mo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove file' })).toBeInTheDocument();
  });

  it('calls onChange(null) when remove is clicked', async () => {
    const onChange = vi.fn();
    const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' });
    render(<DocumentUpload {...baseProps} file={file} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove file' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows error message when error prop provided', () => {
    render(<DocumentUpload {...baseProps} file={null} error="File required" onChange={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('File required');
  });

  it('passes axe a11y check (empty)', async () => {
    const { container } = render(<DocumentUpload {...baseProps} file={null} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check (uploaded)', async () => {
    const file = new File(['x'], 'f.pdf', { type: 'application/pdf' });
    const { container } = render(<DocumentUpload {...baseProps} file={file} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
