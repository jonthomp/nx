import {
  categorizeRelatedDocuments,
  ProcessedDocument,
  RelatedDocument,
} from '@nx/nx-dev-models-document';
import { Breadcrumbs, Footer, GitHubStarWidget } from '@nx/nx-dev-ui-common';
import { renderMarkdown } from '@nx/nx-dev-ui-markdoc';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { cx } from '@nx/nx-dev-ui-primitives';
import { useRef, useState, useEffect } from 'react';
import { collectHeadings, TableOfContents } from './table-of-contents';
import { RelatedDocumentsSection } from './related-documents-section';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';
import { FeedbackDialog } from '@nx/nx-dev-feature-feedback';

export function DocViewer({
  document,
  relatedDocuments,
  widgetData,
}: {
  document: ProcessedDocument;
  relatedDocuments: RelatedDocument[];
  widgetData: { githubStarsCount: number };
}): JSX.Element {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState<string>('');
  const [basePath, setBasePath] = useState<string>('');

  useEffect(() => {
    setCurrentPath(router.asPath);
    setBasePath(router.basePath);
  }, [router.asPath, router.basePath]);

  const hideTableOfContent =
    currentPath.endsWith('/getting-started') ||
    currentPath.includes('/ci/intro/ci-with-nx') ||
    currentPath.includes('/extending-nx/intro/getting-started') ||
    currentPath.includes('/nx-api/devkit') ||
    currentPath.includes('/reference/glossary') ||
    currentPath.includes('/ci/reference/release-notes');
  const ref = useRef<HTMLDivElement | null>(null);

  const { metadata, node, treeNode } = renderMarkdown(
    document.content.toString(),
    {
      filePath: document.filePath,
      headingClass: 'scroll-mt-8',
    }
  );

  const vm = {
    title: metadata['title'] ?? document.name,
    description: metadata['description'] ?? document.description,
    mediaImage: document.mediaImage,
    content: node,
    relatedContentData: categorizeRelatedDocuments(relatedDocuments),
    tableOfContent: collectHeadings(treeNode),
  };

  function getExtension(path: string): string {
    const splits = path.split('.');
    return splits[splits.length - 1];
  }

  const [showFeedback, setShowFeedback] = useState(false);

  function submitIdeaFeedback(feedback: string) {
    // sanitize the feedback from the user script tags/other malicious code
    const sanitizedFeedback = feedback.replace(/(<([^>]+)>)/gi, '');

    sendCustomEvent('feedback', 'feedback', 'idea', undefined, {
      feedback: sanitizedFeedback,
    });
  }

  return (
    <>
      <NextSeo
        title={vm.title + ' | Nx'}
        description={
          vm.description ??
          'An AI-first build platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.'
        }
        openGraph={{
          url: 'https://nx.dev' + currentPath,
          title: vm.title,
          description:
            vm.description ??
            'An AI-first build platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.',
          images: [
            {
              url: `https://nx.dev/images/open-graph/${currentPath
                .replace('/', '')
                .replace(/\//gi, '-')}.${
                vm.mediaImage ? getExtension(vm.mediaImage) : 'jpg'
              }`,
              width: 1600,
              height: 800,
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
        additionalMetaTags={
          metadata.keywords
            ? [
                {
                  name: 'keywords',
                  content: metadata.keywords,
                },
              ]
            : []
        }
      />

      <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
        <div id="content-wrapper" className="w-full flex-auto flex-col">
          <div className="mb-6 pt-8">
            <Breadcrumbs document={document} />
          </div>
          <div className="min-w-0 flex-auto pb-24 lg:pb-16">
            {/*MAIN CONTENT*/}
            <div className="justify-between xl:flex">
              <div className="relative">
                <div
                  ref={ref}
                  data-document="main"
                  className={cx(
                    'prose prose-slate dark:prose-invert w-full max-w-none 2xl:max-w-4xl',
                    { 'xl:max-w-2xl': !hideTableOfContent }
                  )}
                >
                  {vm.content}
                </div>
              </div>
              {!hideTableOfContent && (
                <div>
                  <div
                    className={cx(
                      'sticky top-2 z-20 ml-[max(2rem,calc(50%-8rem))] hidden w-60 space-y-6 overflow-y-auto bg-white text-sm xl:block dark:bg-slate-900'
                    )}
                  >
                    {widgetData.githubStarsCount > 0 && (
                      <div className="px-6">
                        <GitHubStarWidget
                          starsCount={widgetData.githubStarsCount}
                        />
                      </div>
                    )}
                    <TableOfContents
                      elementRef={ref}
                      path={basePath}
                      headings={vm.tableOfContent}
                      document={document}
                    >
                      <>
                        <div className="my-4 flex items-center justify-center space-x-2 rounded-md border border-slate-200 pl-2 pr-2 hover:border-slate-400 dark:border-slate-700 print:hidden">
                          <button
                            type="button"
                            aria-label="Give feedback on this page"
                            title="Give feedback of this page"
                            className="whitespace-nowrap border-transparent px-4 py-2 font-bold hover:text-slate-900 dark:hover:text-sky-400"
                            onClick={() => setShowFeedback(true)}
                          >
                            Feedback
                          </button>
                        </div>
                        <div className="my-4 flex items-center justify-center space-x-2 rounded-md border border-slate-200 pl-2 pr-2 hover:border-slate-400 dark:border-slate-700 print:hidden">
                          {document.filePath ? (
                            <a
                              aria-hidden="true"
                              href={[
                                'https://github.com/nrwl/nx/blob/master',
                                document.filePath
                                  .replace(
                                    'nx-dev/nx-dev/public/documentation',
                                    'docs'
                                  )
                                  .replace('public/documentation', 'docs'),
                              ].join('/')}
                              target="_blank"
                              rel="noreferrer"
                              title="Edit this page on GitHub"
                              className="whitespace-nowrap border-transparent px-4 py-2 font-bold hover:text-slate-900 dark:hover:text-sky-400"
                            >
                              Edit this page
                            </a>
                          ) : null}
                        </div>
                      </>
                    </TableOfContents>
                  </div>
                </div>
              )}
            </div>
            {/*RELATED CONTENT*/}

            <div
              data-document="related"
              className={cx(
                'prose prose-slate dark:prose-invert w-full max-w-none pt-8 2xl:max-w-4xl',
                { 'xl:max-w-2xl': !hideTableOfContent }
              )}
            >
              <RelatedDocumentsSection
                relatedCategories={vm.relatedContentData}
              />
            </div>
          </div>
          <div
            className={`flex w-full items-center space-x-2 pb-24 pt-24 sm:px-6 lg:pb-16 ${
              hideTableOfContent ? '' : 'xl:hidden'
            }`}
          >
            <div className="ml-4 flex h-0.5 w-full flex-grow rounded bg-slate-50 dark:bg-slate-800/60" />
            <div className="relative z-0 inline-flex flex-shrink-0 rounded-md shadow-sm">
              <button
                type="button"
                aria-label="Give feedback on this page"
                title="Give feedback of this page"
                className={`relative inline-flex items-center rounded-l-md ${
                  // If there is no file path for this page then don't show edit button.
                  document.filePath ? '' : 'rounded-r-md '
                }border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800`}
                onClick={() => setShowFeedback(true)}
              >
                Feedback
              </button>
              {document.filePath ? (
                <a
                  aria-hidden="true"
                  href={[
                    'https://github.com/nrwl/nx/blob/master',
                    document.filePath
                      .replace('nx-dev/nx-dev/public/documentation', 'docs')
                      .replace('public/documentation', 'docs'),
                  ].join('/')}
                  target="_blank"
                  rel="noreferrer"
                  title="Edit this page on GitHub"
                  className="relative -ml-px inline-flex items-center rounded-r-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800"
                >
                  Edit this page
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <FeedbackDialog
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        onFeedbackSubmit={submitIdeaFeedback}
      />
      <Footer />
    </>
  );
}
