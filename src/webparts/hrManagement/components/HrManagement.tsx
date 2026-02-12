import * as React from 'react';
// import styles from './HrManagement.module.scss';
import type { IHrManagementProps } from './IHrManagementProps';
// import { escape } from '@microsoft/sp-lodash-subset';
import App from './App';

export default class HrManagement extends React.Component<IHrManagementProps> {
  public render(): React.ReactElement<IHrManagementProps> {
    // const {
    //   description,
    //   isDarkTheme,
    //   environmentMessage,
    //   hasTeamsContext,
    //   userDisplayName
    // } = this.props;

    return (
      <App sp={this.props.sp} />
    );
  }
}
