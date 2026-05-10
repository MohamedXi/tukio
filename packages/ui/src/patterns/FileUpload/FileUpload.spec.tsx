import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { FileUpload } from './FileUpload';

beforeAll(() => {
  if (!global.URL.createObjectURL) {
    Object.defineProperty(global.URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock') });
    Object.defineProperty(global.URL, 'revokeObjectURL', { value: vi.fn() });
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('FileUpload', () => {
  it('renders drop zone with file input + label', () => {
    const { container } = render(<FileUpload onChange={() => {}} />);
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(screen.getByText('Drop files here or click to upload')).toBeInTheDocument();
  });

  it('accepts files via input change and calls onChange', () => {
    const onChange = vi.fn();
    const { container } = render(<FileUpload onChange={onChange} multiple />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith([file]);
  });

  it('rejects files exceeding maxSize and calls onError', () => {
    const onChange = vi.fn();
    const onError = vi.fn();
    const { container } = render(<FileUpload maxSize={5} onChange={onChange} onError={onError} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File(['a'.repeat(100)], 'big.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [big] } });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'fileTooLarge', fileName: 'big.txt' }),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects file types not in accept', () => {
    const onError = vi.fn();
    const { container } = render(
      <FileUpload accept="image/*" onChange={() => {}} onError={onError} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const txt = new File(['x'], 'doc.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [txt] } });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'fileTypeNotAllowed' }));
  });

  it('removes file via remove button', async () => {
    const onChange = vi.fn();
    const { container } = render(<FileUpload onChange={onChange} multiple />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    await userEvent.click(screen.getByLabelText('Remove file'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<FileUpload onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
