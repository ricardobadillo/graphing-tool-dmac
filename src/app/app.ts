import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteNav } from './site-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteNav],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
