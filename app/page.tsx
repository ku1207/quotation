'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // 1단계: 파일 업로드 및 분석
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || '파일 업로드에 실패했습니다.');
      }

      // 2단계: AI 전략 시나리오 생성
      const generateResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysisResult: uploadResult.data }),
      });

      const generateResult = await generateResponse.json();

      if (!generateResponse.ok) {
        throw new Error(generateResult.error || 'AI 리포트 생성에 실패했습니다.');
      }

      // 분석 결과와 AI 리포트를 localStorage에 저장
      localStorage.setItem('analysisResult', JSON.stringify(uploadResult.data));
      localStorage.setItem('aiReport', JSON.stringify(generateResult.report));

      // 대시보드로 이동
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            네이버 검색광고 견적 분석 도구
          </h1>
          <p className="text-gray-600">
            엑셀 파일을 업로드하면 AI 기반 전략 분석 리포트를 제공합니다
          </p>
        </div>

        <div className="space-y-6">
          {/* 파일 업로드 영역 */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              id="file-upload"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="w-12 h-12 text-gray-400 mb-3" />
              <span className="text-sm font-medium text-gray-700 mb-1">
                클릭하여 파일 선택
              </span>
              <span className="text-xs text-gray-500">
                .xlsx 또는 .xls 파일 (최대 10MB)
              </span>
            </label>
          </div>

          {/* 선택된 파일 정보 */}
          {file && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-sm text-red-600 hover:text-red-700"
                disabled={uploading}
              >
                제거
              </button>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* 업로드 버튼 */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>분석 중...</span>
              </>
            ) : (
              <span>분석 시작</span>
            )}
          </button>
        </div>

        {/* 안내 사항 */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">필수 파일 형식</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>네이버 검색광고 견적 엑셀 파일 (.xlsx, .xls)</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>2줄 헤더 포함 (PC/MO 구분, 순위별 클릭/비용/CPC)</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>PC 1~10위, MO 1~5위 데이터 포함</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
