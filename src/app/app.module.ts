import { NgModule } from '@angular/core';
import { RouteReuseStrategy } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { Zip } from '@ionic-native/zip/ngx';
import { HTTP } from '@ionic-native/http/ngx';
import { SQLite } from '@ionic-native/sqlite/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { Downloader } from '@ionic-native/downloader/ngx';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { IonicStorageModule } from '@ionic/storage-angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { SQLitePorter } from '@ionic-native/sqlite-porter/ngx';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { EpubService } from './services/epub.service';
import { DatabaseService } from './services/database.service';
import { DirectoryService } from './services/directory.service';
import { FileReaderService } from './services/file-reader.service';
import { WebScraperService } from './services/web-scraper.service';
import { JsonDataParserService } from './services/json-data-parser.service';

import { AppRoutingModule } from 'src/app/app-routing.module';

import { AppComponent } from 'src/app/app.component';


@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    IonicStorageModule.forRoot(),
    HammerModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    DatabaseService,
    DirectoryService,
    Downloader,
    EpubService,
    FileReaderService,
    HTTP,
    JsonDataParserService,
    SplashScreen,
    SQLite,
    SQLitePorter,
    StatusBar,
    WebScraperService,
    WebView,
    Zip,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
