import React, { useState } from 'react';
import { RawProviderApiResponse } from 'ton-inpage-provider';
import { convertError } from '../../common';

export type SignerWorkspaceProps = {
  signData: (data: string) => Promise<RawProviderApiResponse<'signData'>>;
};

export const SignerWorkspace: React.FC<SignerWorkspaceProps> = ({ signData }) => {
  const [data, setData] = useState<string>('');
  const [error, setError] = useState<string>();
  const [output, setOutput] = useState<string>();
  const [inProgress, setInProgress] = useState(false);

  const onSubmit = async () => {
    if (inProgress) {
      return;
    }

    setInProgress(true);
    setError(undefined);
    try {
      const output = await signData(data);
      setOutput(JSON.stringify(output));
    } catch (e) {
      setError(convertError(e.message));
    } finally {
      setInProgress(false);
    }
  };

  return (
    <>
      <section className="section">
        <div className="container is-fluid">
          <div className="field">
            <label className="label">Enter data to sign:</label>
            <div className="control">
              <textarea
                className="textarea"
                spellCheck={false}
                onChange={e => setData(e.target.value)}
                value={data}
                rows={5}
              />
            </div>
          </div>
          <div className="field">
            <div className="control">
              <button disabled={inProgress} className="button is-primary" onClick={onSubmit}>
                Sign
              </button>
            </div>
          </div>
        </div>
        <br />
        <div className="container is-fluid">
          <h5 className="title is-size-5">Output:</h5>
          <pre>{error == null ? output : error}</pre>
        </div>
      </section>
    </>
  );
};
