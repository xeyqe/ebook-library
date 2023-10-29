import { NgModule } from '@angular/core';
import { RouteReuseStrategy } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { IonicStorageModule } from '@ionic/storage-angular';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { HTTP } from '@awesome-cordova-plugins/http/ngx';
import { SQLite } from '@awesome-cordova-plugins/sqlite/ngx';
import { FilePath } from '@awesome-cordova-plugins/file-path/ngx';
import { StatusBar } from '@awesome-cordova-plugins/status-bar/ngx';
import { WebIntent } from '@awesome-cordova-plugins/web-intent/ngx';
import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';
import { FileChooser } from '@awesome-cordova-plugins/file-chooser/ngx';
import { SplashScreen } from '@awesome-cordova-plugins/splash-screen/ngx';
import { SQLitePorter } from '@awesome-cordova-plugins/sqlite-porter/ngx';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';

import { EpubService } from './services/epub.service';
import { DatabaseService } from './services/database.service';
import { DirectoryService } from './services/directory.service';
import { FileReaderService } from './services/file-reader.service';
import { WebScraperService } from './services/web-scraper.service';

import { AppRoutingModule } from 'src/app/app-routing.module';

import { AppComponent } from 'src/app/app.component';


@NgModule({
    declarations: [AppComponent],
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
        BackgroundMode,
        DatabaseService,
        DirectoryService,
        EpubService,
        FileChooser,
        FilePath,
        FileReaderService,
        HTTP,
        SplashScreen,
        SQLite,
        SQLitePorter,
        StatusBar,
        WebIntent,
        WebScraperService,
        WebView,
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
